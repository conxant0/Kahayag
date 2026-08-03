import { Reveal, Rule } from "../../../shared/components/ui";

/**
 * The pull-quote — Figma 2141:51 / 2169:147.
 *
 * Serif italic carries feeling, per the brandbook's voice rule; the attribution
 * drops to sans because it is a fact.
 *
 * A hairline above and below lifts it out of the scroll — the one place on the
 * page where somebody other than us is speaking.
 */
export function QuoteSection() {
  return (
    <section className="mx-auto flex w-full flex-col px-(--gutter) pt-10 pb-8 lg:w-220 lg:pt-[70.4px] lg:pb-[19.2px]">
      <Reveal>
        <figure className="m-0 flex flex-col gap-4 lg:gap-6.5">
          <Rule />

          {/* An amber opening mark rather than a coloured pull-quote: the voice
           * stays ink, and the colour is only the page pointing at it. */}
          <span
            aria-hidden="true"
            className="-mb-2 font-serif text-[44px] leading-none text-sun lg:-mb-4 lg:text-[64px]"
          >
            “
          </span>

          <blockquote className="font-serif text-(length:--t-quote) text-balance text-ink italic">
            “I walked into my first installer meeting with a layout and a
            number. Everything went smoothly.”
          </blockquote>

          <figcaption className="font-sans text-(length:--t-caption) font-medium text-tertiary-ink">
            Rhanzel E. · Homeowner, Mandaue City
          </figcaption>

          <Rule />
        </figure>
      </Reveal>
    </section>
  );
}
