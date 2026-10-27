import { useEffect, useState } from 'react';
import { buildApiUrl } from '../lib/apiClient';
import './UserData.css';

const fields = [
  { key: 'zipCode', label: 'ZIP code' },
  { key: 'collaborationMode', label: 'Parenting plan approach' },
  { key: 'gender', label: 'Gender' },
  { key: 'background', label: 'Background' },
  { key: 'race', label: 'Race / ethnicity' },
  { key: 'income', label: 'Household income' },
  { key: 'household', label: 'Household' },
  { key: 'language', label: 'Language' },
  { key: 'education', label: 'Education' }
];

function summarizeUsers(users) {
  const ages = users
    .map((user) => user.parentAge === null || user.parentAge === undefined || user.parentAge === ''
      ? Number.NaN
      : Number(user.parentAge))
    .filter((age) => Number.isFinite(age));

  const distributions = Object.fromEntries(fields.map(({ key }) => {
    const counts = new Map();
    let respondents = 0;

    users.forEach((user) => {
      const answer = user[key];
      const values = (Array.isArray(answer) ? answer : [answer])
        .map((value) => typeof value === 'string' ? value.trim() : value)
        .filter((value) => value !== null && value !== undefined && value !== '')
        .map(String);
      const uniqueValues = [...new Set(values)];

      if (uniqueValues.length === 0) return;
      respondents += 1;
      uniqueValues.forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
    });

    const choices = Object.fromEntries(
      [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([value, count]) => [
          value,
          {
            count,
            percentage: Math.round((count / respondents) * 1000) / 10
          }
        ])
    );

    return [key, { respondents, choices }];
  }));

  return {
    planRecords: users.length,
    averageParentAge: ages.length
      ? Math.round((ages.reduce((total, age) => total + age, 0) / ages.length) * 10) / 10
      : null,
    parentAgeRespondents: ages.length,
    distributions
  };
}

function DistributionCard({ field, distribution }) {
  const choices = Object.entries(distribution.choices);
  const totalSelections = choices.reduce((total, [, choice]) => total + choice.count, 0);
  let offset = 0;
  const slices = choices.map(([value, choice], index) => {
    const start = offset;
    offset += (choice.count / totalSelections) * 100;
    return `${chartColors[index % chartColors.length]} ${start}% ${offset}%`;
  });
  const chartStyle = {
    background: choices.length
      ? `conic-gradient(${slices.join(', ')})`
      : 'conic-gradient(#e5e7eb 0% 100%)'
  };

  return (
    <article className="user-data__distribution-card">
      <div className="user-data__distribution-heading">
        <h2>{field.label}</h2>
        <span>{distribution.respondents} responses</span>
      </div>
      {choices.length === 0 ? (
        <p className="user-data__empty">No responses yet</p>
      ) : (
        <div className="user-data__chart-content">
          <div
            className="user-data__donut"
            role="img"
            aria-label={`${field.label} distribution across ${totalSelections} selections`}
            style={chartStyle}
          >
            <span className="user-data__donut-center">
              <strong>{totalSelections}</strong>
              <span>selections</span>
            </span>
          </div>
          <ul className="user-data__legend">
            {choices.map(([value, choice], index) => (
              <li key={value}>
                <span
                  className="user-data__legend-swatch"
                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                  aria-hidden="true"
                />
                <span className="user-data__legend-label" title={value}>{value}</span>
                <span className="user-data__legend-count">
                  {choice.count}
                  <span className="user-data__legend-percent">{choice.percentage}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

const chartColors = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#ca8a04',
  '#4f46e5'
];

export default function UserData() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    fetch(buildApiUrl('api/aggregate-data'))
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load aggregate user data');
        }

        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('Aggregate user data response must be a list');
        }

        if (isMounted) setUsers(data);
      })
      .catch((fetchError) => {
        if (isMounted) setError(fetchError.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    return (
      <main className="user-data">
        <p className="user-data__error" role="alert">{error}</p>
      </main>
    );
  }
  if (users === null) {
    return <main className="user-data" aria-busy="true"><p>Loading aggregate data...</p></main>;
  }

  const summary = summarizeUsers(users);

  return (
    <main className="user-data">
      <header className="user-data__header">
        <p className="user-data__eyebrow">Community overview</p>
        <h1>Aggregate data dashboard</h1>
        <p>Explore the demographics and preferences represented in parenting plans.</p>
      </header>

      <section className="user-data__metrics" aria-label="Summary statistics">
        <article className="user-data__metric-card">
          <span className="user-data__metric-label">Plans represented</span>
          <strong>{summary.planRecords.toLocaleString()}</strong>
          <span className="user-data__metric-note">Aggregate plan records</span>
        </article>
        <article className="user-data__metric-card">
          <span className="user-data__metric-label">Average parent age</span>
          <strong>{summary.averageParentAge === null ? '—' : summary.averageParentAge}</strong>
          <span className="user-data__metric-note">
            {summary.parentAgeRespondents.toLocaleString()} age responses
          </span>
        </article>
      </section>

      <section className="user-data__distributions" aria-labelledby="user-data-distributions-title">
        <div className="user-data__section-heading">
          <div>
            <h2 id="user-data-distributions-title">Response distributions</h2>
            <p>Counts show how many plans selected each response. Percentages are of respondents.</p>
          </div>
          <p className="user-data__data-note">
            A plan may include multiple selections, so percentages can add up to more than 100%.
            The total reflects plans, not unique users.
          </p>
        </div>
        <div className="user-data__distribution-grid">
          {fields.map((field) => (
            <DistributionCard
              key={field.key}
              field={field}
              distribution={summary.distributions[field.key]}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
