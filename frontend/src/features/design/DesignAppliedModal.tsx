import { Button, ButtonLink } from "../../shared/components/ui";
import { ROUTE_PATHS } from "../../app/routePaths";

export function DesignAppliedModal({
  open,
  onKeepEditing,
}: {
  open: boolean;
  onKeepEditing: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="design-applied-title"
    >
      <div className="w-full max-w-md rounded-lg border border-hairline bg-paper p-6 shadow-lg">
        <h2 id="design-applied-title" className="font-serif text-2xl text-ink">
          Design applied.
        </h2>
        <p className="mt-2 font-sans text-sm text-secondary">
          Your solver-backed build is ready to compare against alternatives.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <ButtonLink to={ROUTE_PATHS.compare} fullWidth>
            See comparison
          </ButtonLink>
          <Button variant="secondary" fullWidth onClick={onKeepEditing}>
            Keep editing
          </Button>
        </div>
      </div>
    </div>
  );
}
