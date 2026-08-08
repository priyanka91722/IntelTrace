import { useReducedMotion, type Variants } from "motion/react"

/** Stagger a list of items in (Dashboard case cards, Admin user rows). */
export function useListStagger(staggerChildren = 0.04) {
  const reduced = useReducedMotion()
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : staggerChildren } },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 8 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.2, ease: "easeOut" } },
  }
  return { container, item }
}

/** Crossfade for AnimatePresence content swaps (tab panels, notice/error). */
export function useCrossfade(offset = 6) {
  const reduced = useReducedMotion()
  return {
    initial: { opacity: 0, y: reduced ? 0 : -offset },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduced ? 0 : offset },
    transition: { duration: reduced ? 0 : 0.16, ease: "easeOut" },
  } as const
}

/** Reveal-on-scroll for the evidence timeline. */
export function useRevealOnScroll(offset = 10) {
  const reduced = useReducedMotion()
  return {
    initial: { opacity: 0, x: reduced ? 0 : -offset },
    whileInView: { opacity: 1, x: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: { duration: reduced ? 0 : 0.3, ease: "easeOut" },
  } as const
}

/** One-off entrance fade for page headers / brand blocks, with optional stagger delay. */
export function useFadeIn(delay = 0) {
  const reduced = useReducedMotion()
  return {
    initial: { opacity: 0, y: reduced ? 0 : -6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.25, ease: "easeOut", delay: reduced ? 0 : delay },
  } as const
}

export const tapScale = { scale: 0.97 }
