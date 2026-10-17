import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Section entrance: parts arrive in reading order, rising 24px, once.
 * Under reduced motion the content is simply present.
 */
export function Reveal({ children, delay = 0, className, as = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' }) {
  const reduce = useReducedMotion();
  const Tag = as === 'li' ? motion.li : motion.div;
  if (reduce) return as === 'li' ? <li className={className}>{children}</li> : <div className={className}>{children}</div>;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.75, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}
