// Defines the dashed compare-custom stub on the compare screen.
function PlusIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 3.5v13M3.5 10h13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CompareCustomCard() {
  return (
    <article
      className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#d8d2c4] px-6 py-[30px]"
      aria-label="Compare custom stub"
    >
      <div className="flex size-[58px] items-center justify-center rounded-pill bg-[#f2eee4] text-secondary">
        <PlusIcon />
      </div>
      <h2 className="mt-5 text-center font-serif text-[21px] font-medium leading-7 text-tertiary">
        Compare custom
      </h2>
      <p className="mt-2.5 text-center font-sans text-[12.5px] leading-5 text-tertiary">
        Test a different mix of components and capacity.
      </p>
    </article>
  );
}
