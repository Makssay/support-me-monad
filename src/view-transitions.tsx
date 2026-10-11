import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
export { Link as TransitionLink } from 'react-router-dom';

export function RouteTransition({ path, children }: { path: string; children: ReactNode }) {
 // A mount transition keeps the page live and also works on history navigation.
 return <div key={path} className="route-fade">{children}</div>;
}

export function StepTransition({ step, direction = 1, children }: { step: number; direction?: number; children: ReactNode }) {
 const reduced = useReducedMotion();
 // Keep local step feedback independent of browser navigation and network retries.
 return <motion.div key={step} initial={reduced ? false : { opacity: 0, transform: `translateX(${direction * 12}px)` }}
  animate={{ opacity: 1, transform: 'translateX(0px)' }} transition={{ duration: reduced ? 0 : .2, ease: [.23, 1, .32, 1] }}>
  {children}
 </motion.div>;
}
