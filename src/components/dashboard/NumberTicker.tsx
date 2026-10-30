"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

// Счётчик: при загрузке и при каждом обновлении число «докручивается» до нового значения.
export function NumberTicker({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = String(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (node.textContent = String(Math.round(v))),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span ref={ref} className={`num ${className ?? ""}`}>
      {value}
    </span>
  );
}
