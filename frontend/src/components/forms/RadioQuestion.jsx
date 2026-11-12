import { Card, CardHeader, CardDescription, CardContent } from '../common/card';
import RadioButton from './RadioButton';
import FlagButton from './FlagButton';
import TextInput from './TextInput';
import Disclaimer from './Disclaimer';
import HelpMenu from '../common/HelpMenu';

/**
 * A complete radio-button question card with optional flag, validation error,
 * and an optional conditional text input that appears when a specific option is selected.
 *
 * @param {string}   question          - The question text displayed in the card header
 * @param {string}   help              - Optional help text displayed below the question
 * @param {string}   name              - The radio group name attribute
 * @param {string}   value             - The currently selected value
 * @param {function} onChange          - Called with the selected string value: (value: string) => void
 * @param {Array}    options           - [{ value, label, description? }]
 * @param {object}   flag              - Optional flag hook result: { isFlagged, toggleFlag }
 * @param {string}   error             - Optional validation error message
 * @param {object}   conditionalInput  - Optional text input shown when a specific option is chosen:{ triggerValue, id, label, value, onChange, placeholder } 
 * @param {Array}    disclaimers       - Optional array of disclaimers, each with { disclaimer, disclaimerVariant } default variant is 'info'
 */
export default function RadioQuestion({
  question,
  help,
  name,
  value,
  onChange,
  options,
  flag,
  error,
  conditionalInput,
  disclaimers,
  autoFocus = false,
}) {
  return (
    <Card>
      <CardHeader className={flag ? 'card-header-with-flag' : undefined}>
        <CardDescription id={`${name}-question`} className="card-heading-question-bold">
          {question.replace(/\\n/g, '\n')}
          <HelpMenu text={help} />
        </CardDescription>
        {flag && (
          <FlagButton isFlagged={flag.isFlagged} onClick={flag.toggleFlag} />
        )}
      </CardHeader>
      <CardContent>
        <div className="radio-group" role="radiogroup" aria-labelledby={`${name}-question`}>
          {options.map((option, index) => (
            <RadioButton
              key={option.value}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              label={option.label}
              description={option.description}
              autoFocus={autoFocus && index === Math.max(options.findIndex(option => option.value === value), 0)}
            />
          ))}

          {conditionalInput && value === conditionalInput.triggerValue && (
            <TextInput
              className="text-input-long-text"
              id={conditionalInput.id}
              label={conditionalInput.label}
              type="text"
              value={conditionalInput.value}
              onChange={conditionalInput.onChange}
              placeholder={conditionalInput.placeholder}
              error={conditionalInput.error}
            />
          )}
        </div>
        {disclaimers?.map((item, index) => (
          <Disclaimer key={index} variant={item.disclaimerVariant ?? 'info'}>
            {item.disclaimer}
          </Disclaimer>
        ))}
        {error && (
          <div className="radio-group-error" role="alert">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
