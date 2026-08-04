// Defines the RTINGS-style side-by-side build comparison matrix.
import { Button } from "../../shared/components/ui";
import { cn } from "../../shared/lib/cn";
import { CompareColumnPicker } from "./CompareColumnPicker";
import type { CompareColumn, CompareMatrixRow } from "./compareColumnsViewModel";
import { MiniSystemDiagram } from "./MiniSystemDiagram";

function SparkIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M6 0.5L6.85 4.15L10.5 5L6.85 5.85L6 9.5L5.15 5.85L1.5 5L5.15 4.15L6 0.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ColumnHeader({ column }: { column: CompareColumn }) {
  return (
    <div
      className={cn(
        "flex min-h-[7.5rem] flex-col gap-2 border-b border-hairline px-4 py-4",
        column.isSuggested ? "bg-[#fffdf5]" : "bg-white",
      )}
    >
      {column.isSuggested ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-sun px-2.5 py-1 font-sans text-[9px] font-semibold tracking-[0.8px] text-ink uppercase">
          <SparkIcon />
          Best all-round
        </span>
      ) : null}
      <h3 className="font-serif text-[22px] leading-none font-medium text-ink">
        {column.label}
      </h3>
      <span
        className={cn(
          "inline-flex w-fit rounded-pill px-2.5 py-1 font-sans text-[10px] font-semibold tracking-[0.4px]",
          column.isSuggested
            ? "bg-[#fff4cc] text-[#7a5c00]"
            : "bg-[#f2eee4] text-secondary",
        )}
      >
        {column.trait}
      </span>
    </div>
  );
}

function ColumnActions({
  column,
  onSelectBuild,
  onSelectQuote,
}: {
  column: CompareColumn;
  onSelectBuild: (buildId: string) => void;
  onSelectQuote: (filename: string) => void;
}) {
  if (column.kind === "quote") {
    const filename = column.quote?.filename;
    if (!filename) {
      return null;
    }

    return (
      <div className="border-t border-hairline px-4 py-4">
        <Button
          fullWidth
          variant="ghost"
          className="h-11 border-hairline bg-white text-[13px] text-ink hover:border-tertiary"
          onClick={() => onSelectQuote(filename)}
        >
          Use this quotation
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-hairline px-4 py-4">
      <Button
        fullWidth
        variant={column.isSuggested ? "primary" : "ghost"}
        className={
          column.isSuggested
            ? "h-11"
            : "h-11 border-hairline bg-white text-[13px] text-ink hover:border-tertiary"
        }
        onClick={() => onSelectBuild(column.id)}
      >
        Use for quotation
      </Button>
    </div>
  );
}

export function BuildSideBySideCompare({
  allColumns,
  selectedColumns,
  rows,
  leftId,
  rightId,
  onLeftChange,
  onRightChange,
  onSelectBuild,
  onSelectQuote,
}: {
  allColumns: CompareColumn[];
  selectedColumns: CompareColumn[];
  rows: CompareMatrixRow[];
  leftId: string;
  rightId: string;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onSelectBuild: (buildId: string) => void;
  onSelectQuote: (filename: string) => void;
}) {
  const gridTemplate = "11rem minmax(0, 1fr) minmax(0, 1fr)";

  if (selectedColumns.length < 2) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <CompareColumnPicker
        columns={allColumns}
        leftId={leftId}
        rightId={rightId}
        onLeftChange={onLeftChange}
        onRightChange={onRightChange}
      />

      <section
        aria-label="Side-by-side build comparison"
        className="overflow-hidden rounded-[20px] border border-hairline bg-white shadow-[0_3px_10px_rgba(26,23,18,0.04)]"
      >
        <div
          className="grid border-b border-hairline bg-[#fbf8f1]"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="border-r border-hairline px-4 py-4">
            <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
              Compare
            </p>
            <p className="mt-1 font-sans text-[13px] font-semibold text-ink">2 builds</p>
          </div>
          {selectedColumns.map((column) => (
            <ColumnHeader key={column.id} column={column} />
          ))}
        </div>

        <div className="border-b border-hairline bg-white px-4 py-3">
          <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
            System layout
          </p>
        </div>

        <div className="grid grid-cols-1 border-b border-hairline md:grid-cols-2">
          {selectedColumns.map((column, index) => (
            <div
              key={`${column.id}-diagram`}
              className={cn(
                "min-w-0 overflow-x-auto px-3 py-6 sm:px-5",
                index === 0 ? "md:border-r md:border-hairline" : "",
                column.isSuggested ? "bg-[#fffdf5]/60" : "bg-[#fcfaf5]",
              )}
            >
              <MiniSystemDiagram components={column.components} />
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div
            key={row.label}
            className="grid border-b border-hairline last:border-b-0"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="flex items-center border-r border-hairline bg-[#fbf8f1] px-4 py-3">
              <p className="font-sans text-[12px] font-medium text-secondary">{row.label}</p>
            </div>
            {row.values.map((value, index) => {
              const column = selectedColumns[index];
              if (!column) {
                return null;
              }
              return (
                <div
                  key={`${column.id}-${row.label}`}
                  className={cn(
                    "min-w-0 border-r border-hairline px-4 py-3 last:border-r-0",
                    column.isSuggested ? "bg-[#fffdf5]/40" : "bg-white",
                  )}
                >
                  <p className="font-sans text-[13px] font-semibold break-words text-ink">
                    {value}
                  </p>
                </div>
              );
            })}
          </div>
        ))}

        <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="border-r border-hairline bg-[#fbf8f1] px-4 py-4" />
          {selectedColumns.map((column) => (
            <ColumnActions
              key={`${column.id}-actions`}
              column={column}
              onSelectBuild={onSelectBuild}
              onSelectQuote={onSelectQuote}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
