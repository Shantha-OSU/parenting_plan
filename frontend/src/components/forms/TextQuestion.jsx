import { Card, CardHeader, CardDescription, CardContent } from '../common/card';
import HelpMenu from '../common/HelpMenu';
import TextInput from './TextInput';
import FlagButton from './FlagButton';

/**
 * A question card containing a single text (or textarea) input.
 * The question text is displayed in the card header; the TextInput renders below it.
 *
 * @param {string}   question      - The question / prompt shown in the card header
 * @param {string}   id            - Unique id for the input element
 * @param {string}   type          - Input type: 'text' | 'textarea' (default: 'text')
 * @param {string}   value         - Current input value
 * @param {function} onChange      - Called with the new string value
 * @param {string}   placeholder   - Input placeholder text
 * @param {string}   error         - Optional validation error message
 * @param {boolean}  required      - Whether the field is required (default: false)
 * @param {string}   autoComplete  - Optional autocomplete attribute
 * @param {string}   className     - Optional extra class passed to TextInput
 * @param {object}   flag          - Optional flag hook result: { isFlagged, toggleFlag }
 */
export default function TextQuestion({
  question,
  help,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
  autoComplete,
  className,
  flag,
  autoFocus = false,
}) {
  return (
    <Card>
      <CardHeader className={flag ? 'card-header-with-flag' : undefined}>
        <CardDescription className="card-heading-question-bold">
          {question}
          <HelpMenu text={help} />
        </CardDescription>
        {flag && (
          <FlagButton isFlagged={flag.isFlagged} onClick={flag.toggleFlag} />
        )}
      </CardHeader>

      <CardContent>
        <TextInput
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          error={error}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className={className}
        />
      </CardContent>
    </Card>
  );
}
