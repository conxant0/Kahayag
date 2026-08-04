import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { FlowLayout } from "../../shared/components/layout";
import { Chip, Eyebrow, Reveal, Rule } from "../../shared/components/ui";
import { ROUTE_PATHS } from "../../app/routePaths";
import { useAssessmentStore } from "../../state/assessmentStore";
import type { FutureLoad } from "../../state/assessmentStore";
import {
  FUTURE_LOAD_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  PROPERTY_KIND_OPTIONS,
  ROOF_MATERIAL_OPTIONS,
  TIMELINE_OPTIONS,
  USAGE_PATTERN_OPTIONS,
  hasRequiredPlans,
  type PlanOption,
} from "./planOptions";
import { resolveRedirectForStep } from "./sessionGuard";

/** Stagger between cards, in ms — the landing sections step by the same beat. */
const REVEAL_STEP_MS = 60;

/**
 * One question on its own card, with its answers as chips.
 *
 * The question is set in serif because it is the content of this step, not
 * interface around it — the same voice as the page titles that ask everything
 * else in this flow. The corner holds the card's one piece of state: a quiet
 * "optional" until the question is answered, and the engine's cobalt tick
 * once it is, so a glance down the column shows what is left without a
 * progress bar shouting it.
 */
function QuestionCard({
  question,
  answered,
  optional = false,
  delay = 0,
  children,
}: {
  question: string;
  answered: boolean;
  optional?: boolean;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <section
        aria-label={question}
        className="flex flex-col gap-3.5 rounded-2xl border border-hairline bg-white px-5 py-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-[19px] leading-snug font-medium text-ink lg:text-[20px]">
            {question}
          </h2>
          {answered ? (
            <span
              aria-hidden="true"
              className="pt-0.5 font-sans text-[15px] font-semibold text-cobalt"
            >
              ✓
            </span>
          ) : optional ? (
            <span className="shrink-0 pt-1 font-sans text-[11px] font-semibold tracking-[1.4px] uppercase text-tertiary-ink">
              Optional
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </section>
    </Reveal>
  );
}

/** Chips for a pick-one question. Picking the same chip again un-answers it. */
function SingleChoice<T extends string>({
  options,
  value,
  onPick,
}: {
  options: PlanOption<T>[];
  value: T | null;
  onPick: (next: T | null) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <Chip
          key={option.value}
          selected={value === option.value}
          onClick={() => onPick(value === option.value ? null : option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </>
  );
}

/**
 * /plans — what the system should be planned around.
 *
 * The whole step is chips: every question here has a short closed answer, and
 * typing is the one gesture this flow saves for numbers. The two questions
 * above the line gate the way forward because the proposal is framed around
 * them; everything below it is context an installer would ask for, and stays
 * optional so an unsure answer is never forced. The line itself does the
 * telling — a labelled hairline where obligation ends, rather than a legend
 * of asterisks.
 */
export function PlansPage() {
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const roofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const energyInputs = useAssessmentStore((state) => state.energyInputs);
  const plans = useAssessmentStore((state) => state.plans);
  const contactDetails = useAssessmentStore((state) => state.contactDetails);
  const setPlans = useAssessmentStore((state) => state.setPlans);

  const redirect = resolveRedirectForStep("plans", {
    selectedProperty,
    roofPolygon,
    energyInputs,
    plans,
    contactDetails,
  });

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  const loads = plans.futureLoads;

  const toggleLoad = (load: FutureLoad) => {
    const current = loads ?? [];
    const next = current.includes(load)
      ? current.filter((entry) => entry !== load)
      : [...current, load];
    // Deselecting the last one goes back to "not answered" — an empty list is
    // reserved for the explicit "none planned" below.
    setPlans({ futureLoads: next.length > 0 ? next : null });
  };

  return (
    <FlowLayout
      step="Step 4 of 5"
      title="What should we plan around?"
      backHref={ROUTE_PATHS.energy}
      backLabel="Back to your bill"
      nextHref={ROUTE_PATHS.loading}
      nextLabel="See my results"
      nextDisabled={!hasRequiredPlans(plans)}
      lead={
        <p className="font-sans text-[15px] text-secondary lg:text-base">
          Two questions frame your recommendation. Everything under the line is
          optional — it shapes the proposal an installer would make.
        </p>
      }
      paneClassName="lg:overflow-y-auto"
      pane={
        // One column under a thumb, two on desktop: the pane there is most of
        // the screen, and a lone 520px strip left the rest of it as margin.
        <div className="mx-auto grid w-full max-w-130 grid-cols-1 gap-4 py-2 lg:max-w-240 lg:grid-cols-2 lg:content-center lg:items-start lg:gap-5 lg:px-10 lg:py-12">
          <QuestionCard
            question="What is your primary goal?"
            answered={plans.primaryGoal !== null}
          >
            <SingleChoice
              options={PRIMARY_GOAL_OPTIONS}
              value={plans.primaryGoal}
              onPick={(primaryGoal) => setPlans({ primaryGoal })}
            />
          </QuestionCard>

          <QuestionCard
            question="When do you use the most electricity?"
            answered={plans.usagePattern !== null}
            delay={REVEAL_STEP_MS}
          >
            <SingleChoice
              options={USAGE_PATTERN_OPTIONS}
              value={plans.usagePattern}
              onPick={(usagePattern) => setPlans({ usagePattern })}
            />
          </QuestionCard>

          <Reveal delay={REVEAL_STEP_MS * 2} className="lg:col-span-2">
            <div className="flex items-center gap-3 py-2" aria-hidden="true">
              <Rule className="min-w-0 flex-1" />
              <Eyebrow as="span">Optional</Eyebrow>
              <Rule className="min-w-0 flex-1" />
            </div>
          </Reveal>

          <QuestionCard
            question="Planning to add any of these in the next 3–5 years?"
            answered={loads !== null}
            optional
            delay={REVEAL_STEP_MS * 3}
          >
            {FUTURE_LOAD_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                selected={loads?.includes(option.value) ?? false}
                onClick={() => toggleLoad(option.value)}
              >
                {option.label}
              </Chip>
            ))}
            {/* "None" is an answer, not the absence of one: it empties the
                list rather than nulling it, so "nobody said" stays a
                different state from "nothing planned". */}
            <Chip
              selected={loads !== null && loads.length === 0}
              onClick={() =>
                setPlans({
                  futureLoads: loads !== null && loads.length === 0 ? null : [],
                })
              }
            >
              None
            </Chip>
          </QuestionCard>

          <QuestionCard
            question="What is your roof made of?"
            answered={plans.roofMaterial !== null}
            optional
            delay={REVEAL_STEP_MS * 4}
          >
            <SingleChoice
              options={ROOF_MATERIAL_OPTIONS}
              value={plans.roofMaterial}
              onPick={(roofMaterial) => setPlans({ roofMaterial })}
            />
          </QuestionCard>

          <QuestionCard
            question="What kind of property is it?"
            answered={plans.propertyKind !== null}
            optional
            delay={REVEAL_STEP_MS * 5}
          >
            <SingleChoice
              options={PROPERTY_KIND_OPTIONS}
              value={plans.propertyKind}
              onPick={(propertyKind) => setPlans({ propertyKind })}
            />
          </QuestionCard>

          <QuestionCard
            question="Do you own the property?"
            answered={plans.ownsProperty !== null}
            optional
            delay={REVEAL_STEP_MS * 6}
          >
            <Chip
              selected={plans.ownsProperty === true}
              onClick={() =>
                setPlans({
                  ownsProperty: plans.ownsProperty === true ? null : true,
                })
              }
            >
              Yes
            </Chip>
            <Chip
              selected={plans.ownsProperty === false}
              onClick={() =>
                setPlans({
                  ownsProperty: plans.ownsProperty === false ? null : false,
                })
              }
            >
              No
            </Chip>
          </QuestionCard>

          <QuestionCard
            question="When are you planning to install?"
            answered={plans.timeline !== null}
            optional
            delay={REVEAL_STEP_MS * 7}
          >
            <SingleChoice
              options={TIMELINE_OPTIONS}
              value={plans.timeline}
              onPick={(timeline) => setPlans({ timeline })}
            />
          </QuestionCard>
        </div>
      }
    />
  );
}
