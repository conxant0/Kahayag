export function waitForElementSize(element: HTMLElement | null): Promise<void> {
  if (!element) {
    return Promise.resolve();
  }

  if (element.offsetWidth > 0 && element.offsetHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      attempts += 1;

      if (element.offsetWidth > 0 && element.offsetHeight > 0) {
        resolve();
        return;
      }

      if (attempts > 120) {
        resolve();
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

export function scheduleMapResize(
  map: GoogleMap | null,
  onResize?: () => void,
) {
  if (!map || !window.google?.maps?.event) {
    return;
  }

  const run = () => {
    window.google?.maps?.event?.trigger(map, "resize");
    onResize?.();
  };

  run();
  requestAnimationFrame(() => {
    run();
    window.setTimeout(run, 100);
    window.setTimeout(run, 400);
  });
}
