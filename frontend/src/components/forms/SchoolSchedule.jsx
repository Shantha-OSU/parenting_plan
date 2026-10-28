import HolidaySchedule from './HolidaySchedule';

export const SCHOOL_BREAKS = [
  'Spring Break',
  'Winter Break',
  'Summer Break',
  'Sick Days',
  'Professionalism Days',
];

export const SCHOOL_DAY_OPTIONS = {
  'Sick Days': [
    { value: 'eachDay', label: 'Each day' },
    { value: 'alternateDays', label: 'Alternate days' },
    { value: 'parentWithChild', label: 'Whichever parent has the child that day' },
  ],
  'Professionalism Days': [
    { value: 'eachDay', label: 'Each day' },
    { value: 'alternateDays', label: 'Alternate days' },
    { value: 'parentWithChild', label: 'Whichever parent has the child that day' },
  ],
};

export const SCHOOL_DAY_DESCRIPTIONS = {
  'Sick Days': 'Who will watch the child when they are sick?',
  'Professionalism Days': 'Who will watch the child on days that children get off from school?',
};

export default function SchoolSchedule({ value = {}, onChange, errors = {} }) {
  return (
    <HolidaySchedule
      value={value}
      onChange={onChange}
      errors={errors}
      baseHolidays={SCHOOL_BREAKS}
      itemLabel="School break"
      ariaLabel="School schedule"
      introText="Choose whether each school break applies. The schedule details will appear after you select “Applies”."
      idPrefix="school-break"
      optionSets={SCHOOL_DAY_OPTIONS}
      timeDisabledItems={Object.keys(SCHOOL_DAY_OPTIONS)}
      yearFieldLabel="Year / day"
      descriptions={SCHOOL_DAY_DESCRIPTIONS}
    />
  );
}
