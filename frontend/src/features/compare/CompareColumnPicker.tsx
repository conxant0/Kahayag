// Defines pickers for the two builds shown in side-by-side compare.
import { EMPTY_COMPARE_COLUMN_ID, type CompareColumn } from "./compareColumnsViewModel";

function CompareSelect({
  id,
  label,
  value,
  options,
  disabledValue,
  onChange,
  emptyOption,
}: {
  id: string;
  label: string;
  value: string;
  options: CompareColumn[];
  disabledValue: string;
  onChange: (value: string) => void;
  emptyOption?: { value: string; label: string };
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5">
      <span className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[12px] border border-hairline bg-white px-3 font-sans text-[13px] font-semibold text-ink shadow-[0_2px_8px_rgba(26,23,18,0.04)] outline-none focus:border-cobalt"
      >
        {emptyOption ? (
          <option value={emptyOption.value}>{emptyOption.label}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.id} value={option.id} disabled={option.id === disabledValue}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CompareColumnPicker({
  columns,
  leftId,
  rightId,
  onLeftChange,
  onRightChange,
}: {
  columns: CompareColumn[];
  leftId: string;
  rightId: string;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
}) {
  return (
    <div
      aria-label="Choose builds to compare"
      className="overflow-hidden rounded-[16px] border border-hairline bg-[#fbf8f1]"
    >
      <div className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[minmax(6.5rem,8.5rem)_minmax(0,1fr)_minmax(0,1fr)] lg:px-0">
        <div className="hidden items-end px-4 lg:flex">
          <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
            Swap builds
          </p>
        </div>
        <div className="lg:px-4">
          <CompareSelect
            id="compare-left"
            label="Left build"
            value={leftId}
            options={columns}
            disabledValue={rightId}
            onChange={onLeftChange}
          />
        </div>
        <div className="lg:px-4">
          <CompareSelect
            id="compare-right"
            label="Right build"
            value={rightId}
            options={columns}
            disabledValue={leftId}
            onChange={onRightChange}
            emptyOption={
              columns.length < 2
                ? {
                    value: EMPTY_COMPARE_COLUMN_ID,
                    label: "Nothing to compare yet",
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
