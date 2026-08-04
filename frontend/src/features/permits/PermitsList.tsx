// Defines the government permits block (PR #32 review — permits was computed
// and returned by the backend but never rendered). One row per permit, name
// plus issuing agency; an unverified permit surfaces its `unverified_notes`
// with the same ember flagging DocumentRow uses for its unverified catalog
// rows. Flat, hairline-separated rows — no card shells, no status pills.
import { Eyebrow } from "../../shared/components/ui";
import type { PermitAssessment } from "./permitTypes";

export function PermitsList({ assessment }: { assessment: PermitAssessment }) {
  return (
    <section aria-label="Government permits">
      <Eyebrow>02 · Permits</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-medium text-ink">
        Permits this system requires
      </h2>
      <p className="mt-2 max-w-2xl font-sans text-[13px] leading-5 text-secondary">
        Filed with the documents from the checklist below — your installer
        handles the filing itself.
      </p>

      <ul className="mt-4 flex flex-col">
        {assessment.permits.map((permit) => (
          <li key={permit.id} className="border-t border-hairline py-3 first:border-t-0">
            <p className="font-sans text-sm font-semibold text-ink">{permit.name}</p>
            <p className="mt-0.5 font-sans text-xs text-secondary">
              {permit.issuing_agency}
            </p>
            {permit.unverified ? (
              <div className="mt-1.5">
                <p
                  className="font-sans text-xs font-semibold text-ember"
                  title="This entry has not been independently confirmed against a primary source."
                >
                  Unverified — confirm before relying on this
                </p>
                {permit.unverified_notes.map((note) => (
                  <p key={note} className="mt-0.5 max-w-xl font-sans text-[13px] leading-5 text-ember">
                    {note}
                  </p>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
