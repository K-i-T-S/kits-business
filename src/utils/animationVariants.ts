import type { Variants } from 'framer-motion';

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const pageTransition = { duration: 0.3 };

export const itemVariants: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

export const statusVariants: Variants = {
  available: { scale: 1, opacity: 1 },
  occupied: { scale: 1.02, opacity: 1 },
  alert: {
    scale: 1,
    opacity: [1, 0.7, 1],
    transition: { repeat: Infinity, duration: 1 },
  },
};

export const containerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.2,
    },
  },
};
