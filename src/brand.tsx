import { t, useLocale } from './i18n';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Sparkles } from 'lucide-react';
export const missionArt = (category: string) => `/art/${({ Memes: 'memes', Feedback: 'feedback', 'Bug hunting': 'testing', 'Social content': 'social', Replies: 'social', } as Record<string, string>)[category] || 'feedback'}.webp`;
export function BrandArt({ src = '/art/hero.webp', className = '', priority = false }: { src?: string; className?: string; priority?: boolean }) { useLocale(); 
 const [failed, setFailed] = useState(false);
 return failed ? <div className={`art-placeholder ${className}`}><Sparkles size={38}/><span>{t("Creator illustration")}</span></div> : <img className={className} src={src} alt="" width="1024" height="1024" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} onError={() => setFailed(true)}/>;
}
export function HeroArt() {
 const reduced = useReducedMotion();
 return <motion.div className="hero-art hero-mascot-art" aria-hidden="true" initial={reduced ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.3}}>
  <img className="hero-mascot" src="/art/hero-mascot.webp" alt="" width="1024" height="1024" fetchPriority="high" decoding="async"/>
 </motion.div>;
}
