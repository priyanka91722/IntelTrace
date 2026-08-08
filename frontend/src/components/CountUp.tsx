import { useEffect, useState } from "react";

/** Animates a number counting up from 0 to `value` on mount/change.
 * setInterval rather than requestAnimationFrame — a decorative stat counter
 * doesn't need 60fps, and this keeps ticking even in a backgrounded tab
 * instead of freezing until it regains focus. */
export function CountUp({
  value,
  durationMs = 600,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const stepMs = 40;
    const id = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(value * eased));
      if (t >= 1) clearInterval(id);
    }, stepMs);
    return () => clearInterval(id);
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}
