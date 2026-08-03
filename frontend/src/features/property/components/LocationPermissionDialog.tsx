import { useEffect, useRef } from "react";

import { Button } from "../../../shared/components/ui";

/**
 * Asks before the browser does.
 *
 * A browser's own location prompt gives no reason and can only be answered
 * once; if it is dismissed, the permission is stuck and the flow is over. So
 * this explains what the location is for first, and only calls for the real
 * prompt when someone has said yes to a question they could actually read.
 *
 * Built on the native `dialog`, which brings the focus trap, the Escape key,
 * inertness of the page behind, and a backdrop that would otherwise all be
 * hand-rolled and half-right.
 */
export function LocationPermissionDialog({
  open,
  onAllow,
  onDismiss,
}: {
  open: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="location-permission-title"
      // Escape and the backdrop both mean "not now", which is the same answer
      // as Go back, so they are routed to it rather than left to close a
      // dialog the rest of the app still believes is open.
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onDismiss();
        }
      }}
      className={[
        "w-[calc(100vw-2rem)] max-w-100 rounded-card border border-hairline bg-paper p-0",
        "backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]",
      ].join(" ")}
    >
      {/* The padded box is inside, so the click target for "outside" stays the
       * dialog element itself. */}
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <h2
          id="location-permission-title"
          className="font-serif text-[22px] leading-snug font-medium text-balance text-ink sm:text-[26px]"
        >
          Kahayag needs your location to proceed
        </h2>

        <p className="font-sans text-sm text-secondary sm:text-[15px]">
          It is used once, to centre the map on your roof so you can trace it.
          Nothing is stored, and you can search an address or drop a pin
          instead.
        </p>

        {/* Stacked on a phone where a row would cramp both labels, side by
         * side once there is width for them. */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onDismiss} className="sm:w-auto">
            Go back
          </Button>

          <Button
            variant="primary"
            fullWidth
            onClick={onAllow}
            className="sm:w-auto sm:px-6"
          >
            Allow location
          </Button>
        </div>
      </div>
    </dialog>
  );
}
