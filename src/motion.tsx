import { useSyncExternalStore, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';

// Reuse the existing hero's ease-out throughout the product.
export const surfaceEase = [.22, 1, .36, 1] as const;
const reducedMotionQuery = typeof window === 'undefined' ? undefined : window.matchMedia('(prefers-reduced-motion: reduce)');
function subscribeMotionPreference(listener: () => void) {
 reducedMotionQuery?.addEventListener('change', listener);
 return () => reducedMotionQuery?.removeEventListener('change', listener);
}
const motionPreference = () => reducedMotionQuery?.matches ?? false;

export function useSurfaceMotion(enter: number, leave: number, transform: string) {
 const reduce = useSyncExternalStore(subscribeMotionPreference, motionPreference, () => false);
 const hidden = { opacity: 0, transform: reduce ? 'none' : transform };
 return {
  initial: hidden,
  animate: { opacity: 1, transform: reduce ? 'none' : 'translateY(0px) scale(1)' },
  exit: { ...hidden, transition: { duration: reduce ? .08 : leave, ease: surfaceEase } },
  transition: { duration: reduce ? .08 : enter, ease: surfaceEase },
 };
}

export function MobileMenu({ children }: { children: ReactNode }) {
 const present = useIsPresent();
 const entrance = useSurfaceMotion(.18, .14, 'translateY(-6px)');
 return <motion.nav {...entrance} className="nav open mobile-nav" aria-label="Mobile navigation" inert={!present}>{children}</motion.nav>;
}

// The presence boundary stays mounted while a contribution changes status.
// Historical payouts render immediately; only a newly accepted contribution enters.
export function PayoutProof({ accepted, children }: { accepted: boolean; children: ReactNode }) {
 const entrance = useSurfaceMotion(.22, .14, 'translateY(6px)');
 return <AnimatePresence initial={false}>{accepted && <motion.div {...entrance} className="payout-proof">{children}</motion.div>}</AnimatePresence>;
}

export function PayoutCheck({ children }: { children: ReactNode }) {
 const entrance = useSurfaceMotion(.22, .14, 'scale(0.96)');
 return <motion.span {...entrance} className="payout-check">{children}</motion.span>;
}

export function ToastSurface({ children, kind }: { children: ReactNode; kind: string }) {
 const entrance = useSurfaceMotion(.20, .14, 'translateY(8px)');
 const present = useIsPresent();
 return <motion.div {...entrance} className={`toast ${kind}`} role="status" inert={!present}>{children}</motion.div>;
}
