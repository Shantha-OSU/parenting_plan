import { forwardRef, useState, useRef, useEffect, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import './Dropdown.css';

/**
 * Dropdown component with button trigger and menu
 * @param {string} label - Optional label for the dropdown
 * @param {string} buttonText - Text to display on the button
 * @param {string} value - Currently selected value
 * @param {function} onChange - Callback when an item is selected
 * @param {array} options - Array of options {value, label}
 * @param {string} placeholder - Placeholder text when no value is selected
 * @param {boolean} required - Whether the dropdown is required
 * @param {string} error - Error message to display
 * @param {string} helpText - Help text to display below the dropdown
 * @param {string} id - Unique identifier for the dropdown
 */
export default function Dropdown({
  label,
  buttonText,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  required = false,
  error,
  helpText,
  id,
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const generatedId = useId();
  const dropdownId = id || `dropdown-${generatedId}`;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !options.length) return;
    const selectedIndex = options.findIndex(option => option.value === value);
    optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus();
  }, [isOpen, options, value]);

  const closeDropdown = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => buttonRef.current?.focus());
    }
  };

  const handleToggle = () => {
    if (isOpen) closeDropdown();
    else setIsOpen(true);
  };

  const handleButtonKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeDropdown();
    }
  };

  const handleOptionKeyDown = (event, index) => {
    let nextIndex;
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = (index + 1) % options.length;
        break;
      case 'ArrowUp':
        nextIndex = (index - 1 + options.length) % options.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      case 'Escape':
        event.preventDefault();
        closeDropdown(true);
        return;
      case 'Tab':
        closeDropdown();
        return;
      default:
        return;
    }

    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  };

  const handleSelect = (optionValue) => {
    onChange?.(optionValue);
    closeDropdown(true);
  };

  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption?.label || placeholder;

  const dropdownClasses = [
    'dropdown',
    error ? 'dropdown--error' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={dropdownClasses} ref={dropdownRef}>
      {label && (
        <label className="dropdown__label" htmlFor={dropdownId}>
          {label}
          {required && <span className="dropdown__label-required">*</span>}
        </label>
      )}

      <DropdownButton
        id={dropdownId}
        buttonRef={buttonRef}
        text={displayText}
        isOpen={isOpen}
        onClick={handleToggle}
        onKeyDown={handleButtonKeyDown}
        aria-controls={`${dropdownId}-listbox`}
        hasValue={!!value}
        {...props}
      />

      {isOpen && (
        <DropdownMenu id={`${dropdownId}-listbox`}>
          {options.map((option, index) => (
            <DropdownItem
              key={option.value}
              ref={element => { optionRefs.current[index] = element; }}
              onClick={() => handleSelect(option.value)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              isSelected={option.value === value}
            >
              {option.label}
            </DropdownItem>
          ))}
          {options.length === 0 && (
            <div className="dropdown__empty">No options available</div>
          )}
        </DropdownMenu>
      )}

      {error && <div className="dropdown__error-message">{error}</div>}
      {helpText && !error && <div className="dropdown__help-text">{helpText}</div>}
    </div>
  );
}

function DropdownButton({ className, text, isOpen, hasValue, buttonRef, ...props }) {
  const buttonClasses = [
    'dropdown__button',
    isOpen ? 'dropdown__button--open' : '',
    !hasValue ? 'dropdown__button--placeholder' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      ref={buttonRef}
      className={buttonClasses}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      {...props}
    >
      <span className="dropdown__button-text">{text}</span>
      <ChevronDown
        className={`dropdown__button-icon ${isOpen ? 'dropdown__button-icon--rotated' : ''}`}
        size={20}
      />
    </button>
  );
}

function DropdownMenu({ className, children, ...props }) {
  return (
    <div
      role="listbox"
      data-slot="dropdown-menu"
      className={`dropdown__menu ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}

const DropdownItem = forwardRef(function DropdownItem({ className, isSelected, children, onClick, ...props }, ref) {
  const itemClasses = [
    'dropdown__item',
    isSelected ? 'dropdown__item--selected' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      ref={ref}
      role="option"
      aria-selected={isSelected}
      data-slot="dropdown-item"
      className={itemClasses}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
});

function DropdownDivider({ className, ...props }) {
  return (
    <hr
      data-slot="dropdown-divider"
      className={`dropdown__divider ${className || ''}`}
      {...props}
    />
  );
}

export {
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownDivider
};
