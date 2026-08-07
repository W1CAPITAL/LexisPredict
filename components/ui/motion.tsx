"use client";

/**
 * LazyMotion otimizado — só domAnimation (~features mínimas).
 * Prefer reduced-motion: animações viram fade curto ou instant.
 */
import React, { useMemo } from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
  type Transition,
} from "framer-motion";
import { cn } from "@/lib/utils";

export { m, AnimatePresence };
export type { Variants, Transition };

const springSoft: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.85,
};

const springSnap: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 32,
  mass: 0.7,
};

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

function useMotionSafe() {
  const reduced = useReducedMotion();
  return useMemo(
    () => ({
      reduced: !!reduced,
      fadeUp: {
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: reduced
            ? { duration: 0.15 }
            : { ...springSoft, delay: 0 },
        },
        exit: {
          opacity: 0,
          y: reduced ? 0 : -6,
          transition: { duration: 0.12 },
        },
      } as Variants,
      fadeIn: {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: reduced ? 0.12 : 0.28 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      } as Variants,
      scaleIn: {
        hidden: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
        show: {
          opacity: 1,
          scale: 1,
          transition: reduced ? { duration: 0.12 } : springSnap,
        },
      } as Variants,
      staggerContainer: {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: reduced ? 0 : 0.04,
            delayChildren: reduced ? 0 : 0.03,
          },
        },
      } as Variants,
      staggerItem: {
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 },
        show: {
          opacity: 1,
          y: 0,
          transition: reduced ? { duration: 0.1 } : springSoft,
        },
      } as Variants,
    }),
    [reduced]
  );
}

export function FadeUp({
  className,
  children,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  const { fadeUp, reduced } = useMotionSafe();
  return (
    <m.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={reduced ? { duration: 0.12, delay } : { delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </m.div>
  );
}

export function FadeIn({
  className,
  children,
  ...props
}: HTMLMotionProps<"div">) {
  const { fadeIn } = useMotionSafe();
  return (
    <m.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      exit="exit"
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
  const { staggerContainer } = useMotionSafe();
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
  const { staggerItem } = useMotionSafe();
  return (
    <m.div className={cn(className)} variants={staggerItem}>
      {children}
    </m.div>
  );
}

export function MotionCard({
  className,
  children,
  ...props
}: HTMLMotionProps<"div">) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={cn(className)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduced ? undefined : { y: -2 }}
      transition={
        reduced
          ? { duration: 0.12 }
          : { type: "spring", stiffness: 400, damping: 28 }
      }
      {...props}
    >
      {children}
    </m.div>
  );
}

/** Lista virtual-friendly: anima só os N primeiros itens */
export function StaggerList({
  className,
  children,
  maxAnimated = 24,
}: {
  className?: string;
  children: React.ReactNode;
  maxAnimated?: number;
}) {
  const items = React.Children.toArray(children);
  const { staggerContainer, staggerItem, reduced } = useMotionSafe();
  return (
    <m.div
      className={cn(className)}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {items.map((child, i) =>
        i < maxAnimated && !reduced ? (
          <m.div key={i} variants={staggerItem}>
            {child}
          </m.div>
        ) : (
          <div key={i}>{child}</div>
        )
      )}
    </m.div>
  );
}
