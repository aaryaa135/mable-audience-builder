import { useMemo } from "react";
import type { AudienceCondition, EventType, Operator } from "../types/audience";

interface ConditionRowProps {
  condition: AudienceCondition;
  onChange: (id: string, updates: Partial<AudienceCondition>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

const EVENT_TYPES: EventType[] = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "purchase",
];

const OPERATORS: Operator[] = ["at_least", "exactly"];

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function ConditionRow({
  condition,
  onChange,
  onRemove,
  canRemove,
}: ConditionRowProps) {
  const handleEventTypeChange = useMemo(
    () => (event: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(condition.id, { eventType: event.target.value as EventType });
    },
    [condition.id, onChange],
  );

  const handleOperatorChange = useMemo(
    () => (event: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(condition.id, { operator: event.target.value as Operator });
    },
    [condition.id, onChange],
  );

  const handleCountChange = useMemo(
    () => (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(condition.id, { count: event.target.value });
    },
    [condition.id, onChange],
  );

  const handleWithinDaysChange = useMemo(
    () => (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(condition.id, { withinDays: event.target.value });
    },
    [condition.id, onChange],
  );

  const handleRemove = useMemo(
    () => () => {
      onRemove(condition.id);
    },
    [condition.id, onRemove],
  );

  return (
    <div className="condition-row">
      <div className="condition-field">
        <label htmlFor={`event-type-${condition.id}`}>Event</label>
        <select
          id={`event-type-${condition.id}`}
          value={condition.eventType}
          onChange={handleEventTypeChange}
        >
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatLabel(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="condition-field">
        <label htmlFor={`operator-${condition.id}`}>Operator</label>
        <select
          id={`operator-${condition.id}`}
          value={condition.operator}
          onChange={handleOperatorChange}
        >
          {OPERATORS.map((op) => (
            <option key={op} value={op}>
              {op === "at_least" ? "≥ (at least)" : "= (exactly)"}
            </option>
          ))}
        </select>
      </div>

      <div className="condition-field">
        <label htmlFor={`count-${condition.id}`}>Count</label>
        <input
          id={`count-${condition.id}`}
          type="number"
          min="0"
          step="1"
          value={condition.count}
          onChange={handleCountChange}
        />
      </div>

      <div className="condition-field">
        <label htmlFor={`within-days-${condition.id}`}>Within (days)</label>
        <input
          id={`within-days-${condition.id}`}
          type="number"
          min="1"
          step="1"
          value={condition.withinDays}
          onChange={handleWithinDaysChange}
        />
      </div>

      {canRemove && (
        <div className="condition-field condition-remove">
          <button
            type="button"
            className="remove-button"
            onClick={handleRemove}
            aria-label={`Remove ${formatLabel(condition.eventType)} condition`}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}