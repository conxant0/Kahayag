// Defines pickers for the two builds shown in side-by-side compare.
import type { CompareColumn } from "./compareColumnsViewModel";

function CompareSelect({
  id,
  label,
  value,
  options,
  disabledValue,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: CompareColumn[];
  disabledValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-w-[11rem] flex-1 flex-col gap-1.5">
      <span className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-[12px] border border-hairline bg-white px-3 font-sans text-[13px] font-semibold text-ink shadow-[0_2px_8px_rgba(26,23,18,0.04)] outline-none focus:border-cobalt"
      >
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
      className="flex flex-col gap-3 rounded-[16px] border border-hairline bg-[#fbf8f1] px-4 py-4 sm:flex-row sm:items-end sm:justify-center"
    >
      <CompareSelect
        id="compare-left"
        label="Left build"
        value={leftId}
        options={columns}
        disabledValue={rightId}
        onChange={onLeftChange}
      />
      <p className="hidden px-1 pb-3 font-sans text-[13px] font-semibold text-tertiary sm:block">
        vs
      </p>
      <CompareSelect
        id="compare-right"
        label="Right build"
        value={rightId}
        options={columns}
        disabledValue={leftId}
        onChange={onRightChange}
      />
    </div>
  );
}
