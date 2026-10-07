"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
};

// Count-up animation that fires once when scrolled into view.
//
// SSR correctness: the server-rendered HTML now carries the FINAL value,
// not 0, so the first paint is correct even if JavaScript never hydrates
// (reduced-motion, slow network, JS blocked). The animation only runs on
// the client, from 0 → value, after mount — if hydration is slow the
// user sees the correct number first; if hydration is fast they see the
// count-up. Either way they never see a stale "0".
export function StatCounter({ value, suffix = "", prefix = "", duration = 2 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  // Start at the real value for the first client paint too; the effect
  // below snaps it to 0 and animates up, but only after mount.
  const [display, setDisplay] = useState(value);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    setDisplay(0);
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [mounted, inView, value, duration, reduce]);

  return (
    <span ref={ref}>
      {prefix}
      {formatCompact(Math.round(display))}
      {suffix}
    </span>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  return n.toLocaleString("en-US");
}
