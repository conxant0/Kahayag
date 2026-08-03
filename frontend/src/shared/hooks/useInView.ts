// Defines a one-shot viewport-entry hook for scroll-triggered UI.
import { useEffect, useRef, useState } from "react";

type UseInViewOptions = {
  threshold?: number;
  rootMargin?: string;
};

/**
 * Reports the first time an element intersects the viewport, then stops looking.
 *
 * Everything built on this settles once and stays settled, so an observer left
 * attached afterwards is pure cost.
 *
 * Where `IntersectionObserver` does not exist the hook starts *in* view. Failing
 * open shows the content; failing closed would strand it at `opacity: 0`.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: UseInViewOptions = {},
) {
  const { threshold = 0.2, rootMargin = "0px 0px -10% 0px" } = options;

  const ref = useRef<T | null>(null);
  const [hasEntered, setHasEntered] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        setHasEntered(true);
        observer.disconnect();
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, hasEntered] as const;
}
