import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { DesignFlowStepper, DesignStepTabs } from "../../shared/components/layout";
import { Eyebrow, SegmentedToggle } from "../../shared/components/ui";
import { useDesignStore } from "../../state/designStore";
import { BuildCompareCard } from "./BuildCompareCard";
import { BuildSideBySideCompare } from "./BuildSideBySideCompare";
import { CompareCustomCard } from "./CompareCustomCard";
import { QuoteAuditorCard } from "./QuoteAuditorCard";
import {
  compareColumns,
  comparisonMatrix,
  defaultComparePair,
  resolveComparePair,
} from "./compareColumnsViewModel";
import type { CompareLayout } from "./compareTypes";
import { compareBuilds } from "./compareViewModel";
import { compareQuotes } from "./quoteCompareViewModel";
import { QuoteCompareCard } from "./QuoteCompareCard";

const LAYOUT_OPTIONS = [
  { value: "cards", label: "Cards" },
  { value: "matrix", label: "Side by side" },
] as const;

export function ComparePage() {
  const designSession = useDesignStore((state) => state.designSession);
  const quoteAuditResults = useDesignStore((state) => state.quoteAuditResults);
  const selectBuild = useDesignStore((state) => state.selectBuild);
  const selectQuoteAudit = useDesignStore((state) => state.selectQuoteAudit);
  const navigate = useNavigate();
  const [layout, setLayout] = useState<CompareLayout>("matrix");
  const [leftColumnId, setLeftColumnId] = useState("");
  const [rightColumnId, setRightColumnId] = useState("");

  const buildViews = useMemo(
    () => (designSession ? compareBuilds(designSession) : []),
    [designSession],
  );
  const quoteViews = useMemo(() => compareQuotes(quoteAuditResults), [quoteAuditResults]);
  const columns = useMemo(
    () =>
      designSession ? compareColumns(designSession, quoteAuditResults) : [],
    [designSession, quoteAuditResults],
  );
  const columnIds = useMemo(
    () => columns.map((column) => column.id).join(":"),
    [columns],
  );

  useEffect(() => {
    if (columns.length === 0) {
      return;
    }
    const [left, right] = defaultComparePair(columns);
    setLeftColumnId(left);
    setRightColumnId(right);
  }, [columnIds]);

  const selectedColumns = useMemo(
    () => resolveComparePair(columns, leftColumnId, rightColumnId),
    [columns, leftColumnId, rightColumnId],
  );
  const matrixRows = useMemo(
    () => comparisonMatrix(selectedColumns),
    [selectedColumns],
  );

  if (!designSession) {
    return <Navigate to={ROUTE_PATHS.design} replace />;
  }

  const handleSelect = (buildId: string) => {
    selectBuild(buildId);
    navigate(ROUTE_PATHS.quotation);
  };

  const handleSelectQuote = (filename: string) => {
    selectQuoteAudit(filename);
    navigate(ROUTE_PATHS.quotation);
  };

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <main
        id="main"
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 pt-8 pb-16 lg:px-16 lg:pt-16 lg:pb-[72px]"
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex justify-center">
            <DesignFlowStepper activeStep={4} />
          </div>
          <DesignStepTabs />
        </div>

        <header className="flex flex-col items-start">
          <Eyebrow className="tracking-[1.4px]">
            After AI design · Compare builds
          </Eyebrow>
          <h1 className="mt-4 font-serif text-[36px] leading-tight font-medium text-ink lg:text-[54px] lg:leading-[60px]">
            Compare your options.
          </h1>
          <p className="mt-3.5 max-w-[620px] font-sans text-base leading-[26px] text-secondary">
            The real-world financial shape of three ways to build this roof —
            and room to test your own.
          </p>
        </header>

        <div className="flex justify-center">
          <SegmentedToggle
            ariaLabel="Compare layout"
            value={layout}
            options={LAYOUT_OPTIONS}
            onChange={setLayout}
          />
        </div>

        {layout === "matrix" ? (
          <BuildSideBySideCompare
            allColumns={columns}
            selectedColumns={selectedColumns}
            rows={matrixRows}
            leftId={leftColumnId}
            rightId={rightColumnId}
            onLeftChange={setLeftColumnId}
            onRightChange={setRightColumnId}
            onSelectBuild={handleSelect}
            onSelectQuote={handleSelectQuote}
          />
        ) : (
          <section
            aria-label="Build options"
            className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 xl:items-stretch"
          >
            {buildViews.map((view) => (
              <BuildCompareCard
                key={view.build.id}
                view={view}
                onSelect={handleSelect}
              />
            ))}
            {quoteViews.map((view) => (
              <QuoteCompareCard
                key={`${view.result.filename}:${view.index}`}
                view={view}
                onSelectQuote={handleSelectQuote}
              />
            ))}
            <QuoteAuditorCard />
            <CompareCustomCard />
          </section>
        )}

        {layout === "matrix" ? (
          <section
            aria-label="Additional compare tools"
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
          >
            <QuoteAuditorCard />
            <CompareCustomCard />
          </section>
        ) : null}
      </main>
    </div>
  );
}
