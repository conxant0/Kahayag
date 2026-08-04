// Defines the RTINGS-style side-by-side build comparison matrix.
import type { ReactNode } from "react";

import { Button } from "../../shared/components/ui";
import { cn } from "../../shared/lib/cn";
import { CompareColumnPicker } from "./CompareColumnPicker";
import { CompareEmptyColumnActions } from "./CompareEmptyColumnActions";
import type { CompareColumn, CompareMatrixRow } from "./compareColumnsViewModel";
import { COMPARE_MATRIX_GRID } from "./compareLayout";
import { MiniSystemDiagram } from "./MiniSystemDiagram";

function MatrixRow({ children }: { children: ReactNode }) {
  return <div className="contents">{children}</div>;
}

function LabelCell({
  children = null,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center border-r border-b border-hairline bg-[#fbf8f1] px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

function BuildCell({
  column,
  children = null,
  className,
  divider = false,
  lastRow = false,
}: {
  column: CompareColumn;
  children?: ReactNode;
  className?: string;
  divider?: boolean;
  lastRow?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-center border-b border-hairline px-3 py-3 sm:px-4",
        divider && "border-r border-hairline",
        lastRow && "border-b-0",
        column.isSuggested ? "bg-[#fffdf5]/40" : "bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EmptyBuildCell({
  children = null,
  className,
  divider = false,
  lastRow = false,
}: {
  children?: ReactNode;
  className?: string;
  divider?: boolean;
  lastRow?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-center border-b border-hairline bg-[#faf9f6] px-3 py-3 sm:px-4",
        divider && "border-r border-hairline",
        lastRow && "border-b-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EmptyColumnHeader({ divider = false }: { divider?: boolean }) {
  return (
    <EmptyBuildCell
      divider={divider}
      className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 px-3 py-4 text-center sm:px-4"
    >
      <h3 className="font-serif text-[20px] leading-tight font-medium text-tertiary sm:text-[22px]">
        Add to compare
      </h3>
      <p className="max-w-[12rem] font-sans text-[12px] leading-5 text-tertiary">
        Upload a quote or create another build for this column.
      </p>
    </EmptyBuildCell>
  );
}

function EmptyDiagramCell({ divider = false }: { divider?: boolean }) {
  return (
    <EmptyBuildCell
      divider={divider}
      className="flex min-h-[14rem] items-center justify-center px-2 py-5 sm:px-3"
    >
      <div className="flex size-full min-h-[10rem] items-center justify-center rounded-[16px] border-2 border-dashed border-hairline bg-white/70 px-4 py-5">
        <CompareEmptyColumnActions />
      </div>
    </EmptyBuildCell>
  );
}

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

function displayColumnLabel(label: string, kind: CompareColumn["kind"]): string {
  if (kind !== "quote" || label.length <= 28) {
    return label;
  }
  return `${label.slice(0, 22)}…`;
}

function ColumnHeader({ column, divider = false }: { column: CompareColumn; divider?: boolean }) {
  const displayLabel = displayColumnLabel(column.label, column.kind);

  return (
    <BuildCell
      column={column}
      divider={divider}
      className={cn(
        "flex min-h-[7.5rem] flex-col items-center justify-center gap-2 px-3 py-4 text-center sm:px-4",
        column.isSuggested ? "bg-[#fffdf5]" : "bg-white",
      )}
    >
      <div className="min-h-[1.75rem]">
        {column.isSuggested ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-sun px-2.5 py-1 font-sans text-[9px] font-semibold tracking-[0.8px] text-ink uppercase">
            <SparkIcon />
            Best all-round
          </span>
        ) : null}
      </div>
      <h3
        className="max-w-full font-serif text-[20px] leading-tight font-medium break-words text-ink sm:text-[22px]"
        title={column.label !== displayLabel ? column.label : undefined}
      >
        {displayLabel}
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
    </BuildCell>
  );
}

function ColumnActions({
  column,
  divider = false,
  onSelectBuild,
  onSelectQuote,
}: {
  column: CompareColumn;
  divider?: boolean;
  onSelectBuild: (buildId: string) => void;
  onSelectQuote: (filename: string) => void;
}) {
  if (column.kind === "quote") {
    const filename = column.quote?.filename;
    if (!filename) {
      return <BuildCell column={column} divider={divider} lastRow className="bg-white" />;
    }

    return (
      <BuildCell column={column} divider={divider} lastRow className="w-full bg-white py-4">
        <Button
          fullWidth
          variant="primary"
          className="h-11"
          onClick={() => onSelectQuote(filename)}
        >
          Use this quotation
        </Button>
      </BuildCell>
    );
  }

  return (
    <BuildCell
      column={column}
      divider={divider}
      lastRow
      className={cn("w-full", column.isSuggested ? "bg-[#fffdf5]/40" : "bg-white", "py-4")}
    >
      <Button
        fullWidth
        variant={column.isSuggested ? "primary" : "secondary"}
        className="h-11"
        onClick={() => onSelectBuild(column.id)}
      >
        Use for quotation
      </Button>
    </BuildCell>
  );
}

export function BuildSideBySideCompare({
  allColumns,
  leftColumn,
  rightColumn,
  rows,
  leftId,
  rightId,
  onLeftChange,
  onRightChange,
  onSelectBuild,
  onSelectQuote,
}: {
  allColumns: CompareColumn[];
  leftColumn: CompareColumn;
  rightColumn: CompareColumn | null;
  rows: CompareMatrixRow[];
  leftId: string;
  rightId: string;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onSelectBuild: (buildId: string) => void;
  onSelectQuote: (filename: string) => void;
}) {
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
        className="grid overflow-hidden rounded-[20px] border border-hairline bg-white shadow-[0_3px_10px_rgba(26,23,18,0.04)]"
        style={{ gridTemplateColumns: COMPARE_MATRIX_GRID }}
      >
        <MatrixRow>
          <LabelCell className="flex-col items-start py-4">
            <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
              Compare
            </p>
            <p className="mt-1 font-sans text-[13px] font-semibold text-ink">
              {rightColumn ? "2 builds" : "1 build"}
            </p>
          </LabelCell>
          <ColumnHeader column={leftColumn} divider />
          {rightColumn ? (
            <ColumnHeader column={rightColumn} />
          ) : (
            <EmptyColumnHeader />
          )}
        </MatrixRow>

        <MatrixRow>
          <LabelCell className="py-4">
            <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
              System layout
            </p>
          </LabelCell>
          <BuildCell
            column={leftColumn}
            divider
            className={cn(
              "flex min-h-[14rem] items-center justify-center overflow-hidden px-2 py-5 sm:px-3",
              leftColumn.isSuggested ? "bg-[#fffdf5]/60" : "bg-[#fcfaf5]",
            )}
          >
            <MiniSystemDiagram components={leftColumn.components} />
          </BuildCell>
          {rightColumn ? (
            <BuildCell
              column={rightColumn}
              className={cn(
                "flex min-h-[14rem] items-center justify-center overflow-hidden px-2 py-5 sm:px-3",
                rightColumn.isSuggested ? "bg-[#fffdf5]/60" : "bg-[#fcfaf5]",
              )}
            >
              <MiniSystemDiagram components={rightColumn.components} />
            </BuildCell>
          ) : (
            <EmptyDiagramCell />
          )}
        </MatrixRow>

        {rows.map((row) => (
          <MatrixRow key={row.label}>
            <LabelCell>
              <p className="font-sans text-[12px] font-medium text-secondary">{row.label}</p>
            </LabelCell>
            <BuildCell column={leftColumn} divider>
              <p
                className="w-full text-center font-sans text-[13px] font-semibold break-words text-ink tabular-nums"
                title={row.values[0]}
              >
                {row.values[0]}
              </p>
            </BuildCell>
            {rightColumn ? (
              <BuildCell column={rightColumn}>
                <p
                  className="w-full text-center font-sans text-[13px] font-semibold break-words text-ink tabular-nums"
                  title={row.values[1]}
                >
                  {row.values[1]}
                </p>
              </BuildCell>
            ) : (
              <EmptyBuildCell>
                <p className="w-full text-center font-sans text-[13px] font-semibold text-tertiary tabular-nums">
                  {row.values[1]}
                </p>
              </EmptyBuildCell>
            )}
          </MatrixRow>
        ))}

        <MatrixRow>
          <LabelCell className="border-b-0" />
          <ColumnActions
            column={leftColumn}
            divider
            onSelectBuild={onSelectBuild}
            onSelectQuote={onSelectQuote}
          />
          {rightColumn ? (
            <ColumnActions
              column={rightColumn}
              onSelectBuild={onSelectBuild}
              onSelectQuote={onSelectQuote}
            />
          ) : (
            <EmptyBuildCell lastRow className="py-4" />
          )}
        </MatrixRow>
      </section>
    </div>
  );
}
