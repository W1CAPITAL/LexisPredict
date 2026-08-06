"use client";

/**
 * Framer Motion avançado (LazyMotion = bundle menor).
 * Use em listas, cards, páginas — sem importar framer-motion inteiro em todo lugar.
 */
import React from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import { cn } from "@/lib/utils";

export { m, AnimatePresence };
export type { Variants };

/** Provider único — coloque no layout client se quiser LazyMotion global */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 26 },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 28 },
  },
};

export function FadeUp({
  className,
  children,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <m.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={{ delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </m.div>
  );
}

export function Stagger({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <m.div
      className={cn(className)}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <m.div className={cn(className)} variants={staggerItem}>
      {children}
    </m.div>
  );
}

/** Hover lift para cards */
export function MotionCard({
  className,
  children,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <m.div
      className={cn(className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      {...props}
    >
      {children}
    </m.div>
  );
}
