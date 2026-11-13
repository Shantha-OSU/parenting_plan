import "./RadioButton.css";

/**
 * @param {name} param0 - The name attribute for the radio button group, used to group related radio buttons together.
 * @param {value} param1 - The value attribute for the radio button, representing the value that will be submitted if this option is selected.
 * @param {checked} param2 - The checked state of the radio button.
 * @param {onChange} param3 - The onChange handler for the radio button.
 * @param {label} param4 - The label text for the radio button.
 * @param {description} param5 - The description text for the radio button.
 * 
  RadioButton component that renders a styled radio button with a label and description.
  It accepts props for name, value, checked state, onChange handler, label text, and description text.

  @returns RadioButton component
*/
export default function RadioButton({ name, value, checked, onChange, label, description, autoFocus = false }) {
  return (
      <label className="radio-option">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          autoFocus={autoFocus}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onChange(event);
            }
          }}
        />
        <span>
          <div className="radio-option-content">
            <p className="radio-option-text">{label}</p>
            <p className="radio-option-description">{description}</p>
          </div>
        </span>
      </label>
  );
}