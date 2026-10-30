"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

// Переход между страницами: новая страница мягко проявляется и чуть поднимается
// (300–450 мс, кривая выбега из мастер-плана). При «уменьшить движение» — без анимации.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
