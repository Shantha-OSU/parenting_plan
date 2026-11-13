import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import useModalAccessibility from '../../hooks/useModalAccessibility';
import './ScheduleBuilder.css';

const timeToMinutes = (time) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const slotsOverlap = (firstSlot, secondSlot) => {
  if (firstSlot.wholeDay || secondSlot.wholeDay) return true;

  const firstStart = timeToMinutes(firstSlot.startTime);
  const firstEnd = timeToMinutes(firstSlot.endTime);
  const secondStart = timeToMinutes(secondSlot.startTime);
  const secondEnd = timeToMinutes(secondSlot.endTime);

  if ([firstStart, firstEnd, secondStart, secondEnd].some((time) => time === null)) return false;
  return firstStart < secondEnd && secondStart < firstEnd;
};

/**
 * ScheduleBuilder component for creating weekly parenting schedules with time frames
 * @param {object} value - Current schedule data (object with day indices as keys)
 * @param {function} onChange - Callback when schedule changes
 * @param {string} parent1Label - Label for first parent (default: "Parent 1")
 * @param {string} parent2Label - Label for second parent (default: "Parent 2")
 * @param {string} error - Error message to display
 * @param {string} helpText - Help text to display
 */
export default function ScheduleBuilder({
  value = {},
  onChange,
  parent1Label = 'Parent 1',
  parent2Label = 'Parent 2',
  error = '',
  helpText = '',
}) {
  const [schedule, setSchedule] = useState(value);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const modalAccessibility = useModalAccessibility(showModal, () => setShowModal(false));
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('weekly');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceStartTime, setRecurrenceStartTime] = useState('');
  const [recurrenceEndTime, setRecurrenceEndTime] = useState('');
  const [recurrenceParent, setRecurrenceParent] = useState('parent1');
  const [recurrenceWholeDay, setRecurrenceWholeDay] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState('');
  const [slotError, setSlotError] = useState('');

  // Update schedule when value prop changes
  useEffect(() => {
    setSchedule(value);
  }, [value]);

  // Notify parent component of changes
  useEffect(() => {
    if (onChange) {
      onChange(schedule);
    }
  }, [schedule, onChange]);

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  // Get day index (0-27 for 4 weeks)
  const getDayIndex = (week, dayOfWeek) => week * 7 + dayOfWeek;

  // Get day label
  const getDayLabel = (dayOfWeek) => weekDays[dayOfWeek];

  // Handle day click - open modal to edit time slots
  const handleDayClick = (week, dayOfWeek) => {
    const dayIndex = getDayIndex(week, dayOfWeek);
    setSelectedDay({ week, dayOfWeek, dayIndex });
    setRecurrenceDays([dayOfWeek]);
    setRecurrenceParent('parent1');
    setRecurrenceError('');
    setShowModal(true);
  };

  // Update a time slot
  const updateTimeSlot = (slotIndex, field, value) => {
    if (selectedDay === null) return;

    const dayIndex = selectedDay.dayIndex;
    const currentSlots = [...(schedule[dayIndex] || [])];
    let updatedSlot = { ...currentSlots[slotIndex], [field]: value };

    if (field === 'wholeDay' && value === true) {
      updatedSlot = {
        ...updatedSlot,
        wholeDay: true,
        startTime: '',
        endTime: ''
      };
    } else if (field === 'wholeDay' && value === false) {
      updatedSlot.wholeDay = false;
    }

    if (updatedSlot.wholeDay && currentSlots.some((slot, index) => index !== slotIndex && slot)) {
      setSlotError('A whole-day visit cannot overlap another time slot.');
      return;
    }

    const startMinutes = timeToMinutes(updatedSlot.startTime);
    const endMinutes = timeToMinutes(updatedSlot.endTime);
    if (startMinutes !== null && endMinutes !== null) {
      if (endMinutes <= startMinutes) {
        setSlotError('End time must be later than start time.');
        return;
      }
      if (currentSlots.some((slot, index) => index !== slotIndex && slotsOverlap(updatedSlot, slot))) {
        setSlotError('This time overlaps another visit on this day.');
        return;
      }
    }

    currentSlots[slotIndex] = updatedSlot;
    setSlotError('');

    setSchedule(prev => ({
      ...prev,
      [dayIndex]: currentSlots
    }));
  };

  // Remove a time slot
  const removeTimeSlot = (slotIndex) => {
    if (selectedDay === null) return;

    const dayIndex = selectedDay.dayIndex;
    const currentSlots = [...(schedule[dayIndex] || [])];
    currentSlots.splice(slotIndex, 1);

    if (currentSlots.length === 0) {
      // Remove day from schedule if no slots left
      setSchedule(prev => {
        const newSchedule = { ...prev };
        delete newSchedule[dayIndex];
        return newSchedule;
      });
    } else {
      setSchedule(prev => ({
        ...prev,
        [dayIndex]: currentSlots
      }));
    }
    setSlotError('');
  };

  // Clear all time slots for selected day
  const clearDay = () => {
    if (selectedDay === null) return;

    const dayIndex = selectedDay.dayIndex;
    setSchedule(prev => {
      const newSchedule = { ...prev };
      delete newSchedule[dayIndex];
      return newSchedule;
    });
    setSlotError('');
    setRecurrenceError('');
  };

  // Clear entire schedule
  const clearSchedule = () => {
    if (window.confirm('Are you sure you want to clear the entire schedule?')) {
      setSchedule({});
    }
  };

  const toggleRecurrenceDay = (dayOfWeek) => {
    setRecurrenceDays((currentDays) => currentDays.includes(dayOfWeek)
      ? currentDays.filter((day) => day !== dayOfWeek)
      : [...currentDays, dayOfWeek].sort((firstDay, secondDay) => firstDay - secondDay));
    setRecurrenceError('');
  };

  const addForSelectedDay = () => {
    if (selectedDay === null) return false;

    if (!recurrenceWholeDay && (!recurrenceStartTime || !recurrenceEndTime)) {
      setSlotError('Enter a start and end time or select Whole day');
      return false;
    }

    if (!recurrenceWholeDay && timeToMinutes(recurrenceEndTime) <= timeToMinutes(recurrenceStartTime)) {
      setSlotError('End time must be later than start time');
      return false;
    }

    const oneTimeSlot = {
      parent: recurrenceParent,
      startTime: recurrenceWholeDay ? '' : recurrenceStartTime,
      endTime: recurrenceWholeDay ? '' : recurrenceEndTime,
      wholeDay: recurrenceWholeDay,
    };
    const currentSlots = schedule[selectedDay.dayIndex] || [];

    if (currentSlots.some((slot) => slotsOverlap(oneTimeSlot, slot))) {
      setSlotError('This time overlaps or repeats an existing visit on this day.');
      return false;
    }

    setSchedule((currentSchedule) => ({
      ...currentSchedule,
      [selectedDay.dayIndex]: [...(currentSchedule[selectedDay.dayIndex] || []), oneTimeSlot],
    }));
    setSlotError('');
    return true;
  };

  const applyRecurringSchedule = () => {
    if (recurrenceDays.length === 0) {
      setRecurrenceError('Select at least one day of the week');
      return false;
    }

    if (!recurrenceWholeDay && (!recurrenceStartTime || !recurrenceEndTime)) {
      setRecurrenceError('Enter a start and end time or select Whole day');
      return false;
    }

    if (!recurrenceWholeDay && timeToMinutes(recurrenceEndTime) <= timeToMinutes(recurrenceStartTime)) {
      setRecurrenceError('End time must be later than start time');
      return false;
    }

    const recurringSlot = {
      parent: recurrenceParent,
      startTime: recurrenceWholeDay ? '' : recurrenceStartTime,
      endTime: recurrenceWholeDay ? '' : recurrenceEndTime,
      wholeDay: recurrenceWholeDay,
    };

    const recurringDayIndexes = [];
    for (let week = 0; week < 4; week += 1) {
      if (recurrenceFrequency === 'biweekly' && week % 2 !== 0) continue;
      recurrenceDays.forEach((dayOfWeek) => recurringDayIndexes.push(getDayIndex(week, dayOfWeek)));
    }

    if (recurringDayIndexes.some((dayIndex) => (schedule[dayIndex] || []).some((slot) => slotsOverlap(recurringSlot, slot)))) {
      setRecurrenceError('The recurring visit overlaps an existing visit.');
      return false;
    }

    setSchedule((currentSchedule) => {
      const nextSchedule = { ...currentSchedule };
      recurringDayIndexes.forEach((dayIndex) => {
        nextSchedule[dayIndex] = [
          ...(nextSchedule[dayIndex] || []),
          { ...recurringSlot },
        ];
      });
      return nextSchedule;
    });
    setRecurrenceError('');
    return true;
  };

  const applySelectedSchedule = () => {
    if (recurrenceFrequency === 'none') {
      return addForSelectedDay();
    }
    return applyRecurringSchedule();
  };

  const addAndClose = () => {
    if (applySelectedSchedule()) {
      setShowModal(false);
    }
  };

  // Get display text for a day
  const getDayDisplay = (week, dayOfWeek) => {
    const dayIndex = getDayIndex(week, dayOfWeek);
    const slots = schedule[dayIndex];

    if (!slots || slots.length === 0) {
      return null;
    }

    return slots.map((slot, idx) => {
      const time = slot.wholeDay
        ? 'All day'
        : slot.startTime && slot.endTime
          ? `${slot.startTime} - ${slot.endTime}`
          : 'No time set';
      return (
        <div key={idx} className={`schedule-builder__day-slot schedule-builder__day-slot--${slot.parent || 'parent1'}`}>
          <div className="schedule-builder__day-slot-parent">
            {(slot.parent || 'parent1') === 'parent2' ? parent2Label : parent1Label}
          </div>
          <div className="schedule-builder__day-slot-time">{time}</div>
        </div>
      );
    });
  };

  // Get statistics
  const getStats = () => {
    const stats = {
      parent1Days: 0,
      parent2Days: 0,
      splitDays: 0,
      unassignedDays: 0,
      total: 28
    };

    for (let i = 0; i < 28; i++) {
      const slots = schedule[i];
      if (!slots || slots.length === 0) {
        stats.unassignedDays++;
      } else if (slots.length === 1) {
        if ((slots[0].parent || 'parent1') === 'parent2') stats.parent2Days++;
        else stats.parent1Days++;
      } else {
        stats.splitDays++;
      }
    }

    return stats;
  };

  const stats = getStats();

  return (
    <div className="schedule-builder">
      {/* Legend */}
      <div className="schedule-builder__legend">
        <div className="schedule-builder__legend-item">
          <div className="schedule-builder__legend-color schedule-builder__legend-color--parent1"></div>
          <span>{parent1Label}</span>
        </div>
        <div className="schedule-builder__legend-item">
          <div className="schedule-builder__legend-color schedule-builder__legend-color--parent2"></div>
          <span>{parent2Label}</span>
        </div>
        <div className="schedule-builder__legend-item">
          <div className="schedule-builder__legend-color schedule-builder__legend-color--unassigned"></div>
          <span>Unassigned</span>
        </div>
      </div>

      {/* Calendar Grid - 4 weeks */}
      <div className="schedule-builder__weekly-grid">
        {/* Day headers */}
        <div className="schedule-builder__weekday-header">
          <div className="schedule-builder__week-label"></div>
          {weekDays.map(day => (
            <div key={day} className="schedule-builder__weekday">
              {day.substring(0, 3)}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {[0, 1, 2, 3].map(week => (
          <div key={week} className="schedule-builder__week-row">
            <div className="schedule-builder__week-label">{weekLabels[week]}</div>
            {[0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => {
              const dayIndex = getDayIndex(week, dayOfWeek);
              const hasSlots = schedule[dayIndex] && schedule[dayIndex].length > 0;

              return (
                <button
                  key={dayOfWeek}
                  type="button"
                  className={`schedule-builder__day-cell ${hasSlots ? 'schedule-builder__day-cell--has-slots' : ''}`}
                  onClick={() => handleDayClick(week, dayOfWeek)}
                  aria-label={`${getDayLabel(dayOfWeek)} ${weekLabels[week]}`}
                >
                  {getDayDisplay(week, dayOfWeek)}
                  {!hasSlots && <Plus size={16} className="schedule-builder__add-icon" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Statistics */}
      <div className="schedule-builder__stats">
        <div className="schedule-builder__stat">
          <span className="schedule-builder__stat-label">{parent1Label} (full days):</span>
          <span className="schedule-builder__stat-value">{stats.parent1Days}</span>
        </div>
        <div className="schedule-builder__stat">
          <span className="schedule-builder__stat-label">{parent2Label} (full days):</span>
          <span className="schedule-builder__stat-value">{stats.parent2Days}</span>
        </div>
        <div className="schedule-builder__stat">
          <span className="schedule-builder__stat-label">Split days:</span>
          <span className="schedule-builder__stat-value">{stats.splitDays}</span>
        </div>
        <div className="schedule-builder__stat">
          <span className="schedule-builder__stat-label">Unassigned:</span>
          <span className="schedule-builder__stat-value">{stats.unassignedDays}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="schedule-builder__actions">
        <button
          type="button"
          onClick={clearSchedule}
          className="schedule-builder__clear-button"
        >
          Clear Schedule
        </button>
      </div>

      {/* Modal for editing day */}
      {showModal && selectedDay && (
        <div className="schedule-builder__modal-overlay" onClick={() => setShowModal(false)}>
          <div
            ref={modalAccessibility.dialogRef}
            className="schedule-builder__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-builder-modal-title"
            tabIndex="-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={modalAccessibility.handleKeyDown}
          >
            <div className="schedule-builder__modal-header">
              <h3 id="schedule-builder-modal-title">
                {getDayLabel(selectedDay.dayOfWeek)} - {weekLabels[selectedDay.week]}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="schedule-builder__modal-close"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="schedule-builder__modal-content">
              {/* Time slots */}
              <div className="schedule-builder__time-slots">
                {(schedule[selectedDay.dayIndex] || []).map((slot, idx) => (
                  <div key={idx} className="schedule-builder__time-slot">
                    <div className="schedule-builder__time-slot-controls">
                      <div className="schedule-builder__field schedule-builder__field--full">
                        <label className="schedule-builder__label" htmlFor={`slot-parent-${selectedDay.dayIndex}-${idx}`}>
                          Parent responsible for this time
                        </label>
                        <select
                          id={`slot-parent-${selectedDay.dayIndex}-${idx}`}
                          className="schedule-builder__select"
                          value={slot.parent || 'parent1'}
                          onChange={(e) => updateTimeSlot(idx, 'parent', e.target.value)}
                        >
                          <option value="parent1">{parent1Label}</option>
                          <option value="parent2">{parent2Label}</option>
                        </select>
                      </div>

                      {/* Whole day checkbox */}
                      <div className="schedule-builder__field schedule-builder__field--checkbox schedule-builder__field--full">
                        <label className="schedule-builder__checkbox-label">
                          <input
                            type="checkbox"
                            checked={slot.wholeDay}
                            onChange={(e) => updateTimeSlot(idx, 'wholeDay', e.target.checked)}
                            className="schedule-builder__checkbox"
                          />
                          Whole day
                        </label>
                      </div>

                      {/* Start and end times */}
                      <div className="schedule-builder__field schedule-builder__field--full">
                        <label className="schedule-builder__label">Start and end times:</label>
                        <input
                          type="time"
                          step="900"
                          value={slot.startTime || ''}
                          disabled={slot.wholeDay}
                          onChange={(e) => updateTimeSlot(idx, 'startTime', e.target.value)}
                          aria-label="Visitation start time"
                          className="schedule-builder__input"
                        />
                        <label className="schedule-builder__label">End time:</label>
                        <input
                          type="time"
                          step="900"
                          value={slot.endTime || ''}
                          disabled={slot.wholeDay}
                          onChange={(e) => updateTimeSlot(idx, 'endTime', e.target.value)}
                          aria-label="Visitation end time"
                          className="schedule-builder__input"
                        />
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(idx)}
                      className="schedule-builder__remove-slot"
                      aria-label="Remove time slot"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

              </div>
              {slotError && <div className="schedule-builder__recurring-error" role="alert">{slotError}</div>}

              <div className="schedule-builder__recurring-panel">
                <div className="schedule-builder__recurring-heading">
                  <div>
                    <h3>Repeat this visitation</h3>
                    <p>Choose whether this visitation repeats.</p>
                  </div>
                </div>
                <div className="schedule-builder__recurring-controls">
                  <div className="schedule-builder__field">
                    <label className="schedule-builder__label" htmlFor="recurrence-frequency">Repeats:</label>
                    <select
                      id="recurrence-frequency"
                      className="schedule-builder__select"
                      value={recurrenceFrequency}
                      onChange={(event) => setRecurrenceFrequency(event.target.value)}
                    >
                      <option value="none">Doesn&apos;t repeat (this day only)</option>
                      <option value="weekly">Every week</option>
                      <option value="biweekly">Every other week</option>
                    </select>
                  </div>
                  {recurrenceFrequency !== 'none' && (
                    <div className="schedule-builder__field schedule-builder__recurring-days">
                      <span className="schedule-builder__label">On:</span>
                      <div className="schedule-builder__day-checkboxes">
                        {weekDays.map((day, dayOfWeek) => (
                          <label className="schedule-builder__checkbox-label" key={day}>
                            <input
                              type="checkbox"
                              checked={recurrenceDays.includes(dayOfWeek)}
                              onChange={() => toggleRecurrenceDay(dayOfWeek)}
                              className="schedule-builder__checkbox"
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="schedule-builder__field">
                    <label className="schedule-builder__label" htmlFor="recurrence-parent">Parent responsible:</label>
                    <select
                      id="recurrence-parent"
                      className="schedule-builder__select"
                      value={recurrenceParent}
                      onChange={(event) => setRecurrenceParent(event.target.value)}
                    >
                      <option value="parent1">{parent1Label}</option>
                      <option value="parent2">{parent2Label}</option>
                    </select>
                  </div>
                  <div className="schedule-builder__field schedule-builder__field--checkbox">
                    <label className="schedule-builder__checkbox-label">
                      <input
                        type="checkbox"
                        checked={recurrenceWholeDay}
                        onChange={(event) => setRecurrenceWholeDay(event.target.checked)}
                        className="schedule-builder__checkbox"
                      />
                      Whole day
                    </label>
                  </div>
                  <div className="schedule-builder__field schedule-builder__field--full">
                    <label className="schedule-builder__label" htmlFor="recurrence-start-time">Start time:</label>
                    <input
                      id="recurrence-start-time"
                      type="time"
                      step="900"
                      value={recurrenceStartTime}
                      disabled={recurrenceWholeDay}
                      onChange={(event) => {
                        setRecurrenceStartTime(event.target.value);
                        setRecurrenceError('');
                      }}
                      aria-label="Recurring visitation start time"
                      className="schedule-builder__input"
                    />
                    <label className="schedule-builder__label" htmlFor="recurrence-end-time">End time:</label>
                    <input
                      id="recurrence-end-time"
                      type="time"
                      step="900"
                      value={recurrenceEndTime}
                      disabled={recurrenceWholeDay}
                      onChange={(event) => {
                        setRecurrenceEndTime(event.target.value);
                        setRecurrenceError('');
                      }}
                      aria-label="Recurring visitation end time"
                      className="schedule-builder__input"
                    />
                  </div>
                </div>
                {recurrenceError && <div className="schedule-builder__recurring-error" role="alert">{recurrenceError}</div>}
              </div>
            </div>

            <div className="schedule-builder__modal-footer">
              <button
                type="button"
                onClick={clearDay}
                disabled={!schedule[selectedDay.dayIndex]?.length}
                className="schedule-builder__modal-button schedule-builder__modal-button--secondary"
              >
                Clear Day
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="schedule-builder__modal-button schedule-builder__modal-button--secondary"
              >
                Exit
              </button>
              <button
                type="button"
                onClick={addAndClose}
                className="schedule-builder__modal-button schedule-builder__modal-button--primary"
              >
                Add visitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help text and errors */}
      {error && (
        <div className="schedule-builder__error" role="alert">
          {error}
        </div>
      )}

      {helpText && !error && (
        <div className="schedule-builder__help-text">
          {helpText}
        </div>
      )}
    </div>
  );
}
