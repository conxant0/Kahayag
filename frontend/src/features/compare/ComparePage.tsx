import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import {
  DesignFlowStepper,
  DesignStepTabs,
  StepPageHeader,
} from "../../shared/components/layout";
import { SegmentedToggle } from "../../shared/components/ui";
import { useDesignStore } from "../../state/designStore";
import { BuildCompareCard } from "./BuildCompareCard";
import { BuildSideBySideCompare } from "./BuildSideBySideCompare";
import { CompareCardSlot, CompareCardsGrid } from "./CompareCardsGrid";
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

  const [leftColumn, rightColumn] = useMemo(
    () => resolveComparePair(columns, leftColumnId, rightColumnId),
    [columns, leftColumnId, rightColumnId],
  );
  const matrixRows = useMemo(
    () => (leftColumn ? comparisonMatrix(leftColumn, rightColumn) : []),
    [leftColumn, rightColumn],
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
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pt-6 pb-16 sm:px-6 lg:px-16 lg:pt-8 lg:pb-[72px]"
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex justify-center">
            <DesignFlowStepper activeStep={4} />
          </div>
          <DesignStepTabs />
        </div>

        <StepPageHeader
          backHref={ROUTE_PATHS.design}
          backLabel="Back to your design"
          eyebrow="Step 4 of 6 · Compare builds"
          title="Compare your options."
          lead={
            <p>
              The real-world financial shape of three ways to build this roof
              and room to test your own.
            </p>
          }
          actions={
            <SegmentedToggle
              ariaLabel="Compare layout"
              value={layout}
              options={LAYOUT_OPTIONS}
              onChange={setLayout}
            />
          }
        />

        {layout === "matrix" && leftColumn ? (
          <BuildSideBySideCompare
            allColumns={columns}
            leftColumn={leftColumn}
            rightColumn={rightColumn}
            rows={matrixRows}
            leftId={leftColumnId}
            rightId={rightColumnId}
            onLeftChange={setLeftColumnId}
            onRightChange={setRightColumnId}
            onSelectBuild={handleSelect}
            onSelectQuote={handleSelectQuote}
          />
        ) : layout === "cards" ? (
          <CompareCardsGrid>
            {buildViews.map((view) => (
              <CompareCardSlot key={view.build.id}>
                <BuildCompareCard view={view} onSelect={handleSelect} />
              </CompareCardSlot>
            ))}
            {quoteViews.map((view) => (
              <CompareCardSlot key={`${view.result.filename}:${view.index}`}>
                <QuoteCompareCard
                  view={view}
                  onSelectQuote={handleSelectQuote}
                />
              </CompareCardSlot>
            ))}
            <CompareCardSlot>
              <QuoteAuditorCard />
            </CompareCardSlot>
            <CompareCardSlot>
              <CompareCustomCard />
            </CompareCardSlot>
          </CompareCardsGrid>
        ) : null}
      </main>
    </div>
  );
}
