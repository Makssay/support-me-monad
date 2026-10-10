import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
export { Link as TransitionLink } from 'react-router-dom';

export function RouteTransition({ path, children }: { path: string; children: ReactNode }) {
 // A mount transition keeps the page live and also works on history navigation.
 return <div key={path} className="route-fade">{children}</div>;
}

export function StepTransition({ step, children }: { step: number; children: ReactNode }) {
 const reduced = useReducedMotion();
 // Keep local step feedback independent of browser navigation and network retries.
 return <motion.div key={step} initial={reduced ? false : { opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .16 }}>
  {children}
 </motion.div>;
}
