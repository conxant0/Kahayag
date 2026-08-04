// Defines /components — a live specimen sheet for the shared library.
import { useState } from "react";
import type { ReactNode } from "react";

import {
  Button,
  Chip,
  CtaArrow,
  Eyebrow,
  HairlineList,
  HairlineRow,
  InfoPill,
  MapSurface,
  Rule,
  Slider,
  SunLoader,
} from "../../shared/components/ui";

const BILL_PRESETS = ["₱2,500", "₱4,800", "₱8,000"];

/**
 * One block of the sheet. Every component appears in each state a screen can
 * put it in, so the library can be reviewed on its own without walking the
 * product flow to find a disabled button or a failed card.
 */
function Specimen({
  name,
  note,
  children,
}: {
  name: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-hairline pt-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-serif text-2xl font-medium text-ink">{name}</h2>
        <p className="font-sans text-[11px] text-tertiary-ink">{note}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  );
}

export function ComponentsPage() {
  const [selectedPreset, setSelectedPreset] = useState(BILL_PRESETS[1]);
  const [rate, setRate] = useState(11.5);

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16"
    >
      <header className="flex flex-col gap-2">
        <Eyebrow>Component library</Eyebrow>
        <h1 className="font-serif text-5xl font-medium text-ink">
          One master, every screen.
        </h1>
        <p className="font-sans text-[15px] text-secondary">
          Yellow acts, cobalt informs, ember interrupts.
        </p>
      </header>

      <Specimen name="Button" note="primary · secondary · ghost · disabled">
        <Button className="w-70">
          Next: Trace your roof <CtaArrow />
        </Button>
        <Button variant="secondary" className="w-50">
          Edit layout
        </Button>
        <Button variant="ghost">+ Add panel</Button>
        <Button className="w-50" disabled>
          Disabled
        </Button>
      </Specimen>

      <Specimen name="Chip" note="default · selected · read-only">
        {BILL_PRESETS.map((amount) => (
          <Chip
            key={amount}
            selected={selectedPreset === amount}
            onClick={() => setSelectedPreset(amount)}
          >
            {amount}
          </Chip>
        ))}
        <Chip>Read-only</Chip>
      </Specimen>

      <Specimen name="Eyebrow" note="tertiary · cobalt">
        <Eyebrow>Step 1 of 4</Eyebrow>
        <Eyebrow tone="cobalt">92% prediction confidence</Eyebrow>
      </Specimen>

      <Specimen name="Hairline list" note="md · lg">
        <HairlineList className="max-w-90.5">
          <HairlineRow label="System size" value="5.2 kW" />
          <HairlineRow label="Annual output" value="6,840 kWh" />
          <HairlineRow label="Est. installed cost" value="₱350,000" />
          <HairlineRow
            label="Simple payback"
            value="4.8 years"
            valueClassName="text-cobalt"
          />
        </HairlineList>
      </Specimen>

      <Specimen name="Info pill" note="cobalt · ink">
        <InfoPill>10 panels · facing 172° S</InfoPill>
        <InfoPill tone="ink">Usable area · 48 m²</InfoPill>
      </Specimen>

      <Specimen name="Slider" note="labelled range with formatted output">
        <div className="w-full max-w-90.5">
          <Slider
            label="Electricity rate"
            min={6}
            max={18}
            step={0.5}
            value={rate}
            onChange={setRate}
            formatValue={(value) => `₱${value.toFixed(2)} / kWh`}
          />
        </div>
      </Specimen>

      <Specimen name="Sun loader" note="84px · 140px">
        <SunLoader size={84} />
        <SunLoader size={140} />
      </Specimen>

      <Specimen name="Map surface" note="empty pane awaiting a provider">
        <div className="h-56 w-full max-w-90.5">
          <MapSurface />
        </div>
      </Specimen>

      <Specimen name="Rule" note="editorial separator">
        <div className="w-full max-w-90.5">
          <Rule />
        </div>
      </Specimen>
    </main>
  );
}
