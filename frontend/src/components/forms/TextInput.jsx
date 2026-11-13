import './TextInput.css';

/**
 * @param {id} param0 - Unique identifier for the input field
 * @param {label} param1 - The label text for the input field
 * @param {type} param2 - The type of input (e.g., 'text', 'textarea')
 * @param {value} param3 - The current value of the input field
 * @param {onChange} param4 - The function to call when the input value changes
 * @param {placeholder} param5 - Placeholder text for the input field
 * @param {required} param6 - Boolean indicating if the field is required
 * @param {disabled} param7 - Boolean indicating if the field is disabled
 * @param {error} param8 - Error message to display if there's a validation error
 * @param {helpText} param9 - Additional help text to display below the input field
 * @param {maxLength} param10 - Maximum number of characters allowed in the input
 * @param {autoComplete} param11 - The autocomplete attribute for the input field
 * @param {rows} param12 - Number of rows for textarea (if type is 'textarea')
 * @param {className} param13 - Additional class names for custom styling
 * 
  TextInput component that can render either an input or textarea based on the 'type'.
  It handles error display, help text, and dynamic class names for styling.

  @returns TextInput component
*/
export default function TextInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  required = false,
  disabled = false,
  error = '',
  helpText = '',
  maxLength,
  autoComplete,
  rows = 4,
  className = '',
  autoFocus = false,
}) {
  const isTextarea = type === 'textarea';

  // Build className dynamically
  const wrapperClasses = [
    'text-input',
    error && 'text-input--error',
    disabled && 'text-input--disabled',
    className,
  ].filter(Boolean).join(' ');

  const fieldClasses = [
    'text-input__field',
    isTextarea && 'text-input__field--textarea',
  ].filter(Boolean).join(' ');

  // Common input props
  const inputProps = {
    id,
    className: fieldClasses,
    value,
    onChange: (e) => onChange(e.target.value),
    placeholder,
    required,
    disabled,
    autoFocus,
    maxLength,
    autoComplete,
    'aria-invalid': !!error,
    'aria-describedby': error ? `${id}-error` : helpText ? `${id}-help` : undefined,
  };

  return (
    <div className={wrapperClasses}>
      <label htmlFor={id} className="text-input__label">
        {label}
        {required && <span className="text-input__label-required" aria-label="required">*</span>}
      </label>

      {isTextarea ? (
        <textarea {...inputProps} rows={rows} />
      ) : (
        <input {...inputProps} type={type} />
      )}

      {error && (
        <span id={`${id}-error`} className="text-input__error-message" role="alert">
          {error}
        </span>
      )}

      {helpText && !error && (
        <span id={`${id}-help`} className="text-input__help-text">
          {helpText}
        </span>
      )}
    </div>
  );
}
