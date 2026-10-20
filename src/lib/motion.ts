import type { Transition } from 'motion/react';

/**
 * Figma's prototype uses Smart animate · Ease out · 300ms for every transition; this is
 * the one place that encodes it. The CSS side uses the same curve (`ease-figma` in
 * tokens.css) with `duration-300`.
 */
export const figmaEaseOut = [0, 0, 0.58, 1] as const;

export const figmaTransition: Transition = { duration: 0.3, ease: figmaEaseOut };
