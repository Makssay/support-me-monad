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
 const reduced=useReducedMotion();
 return <motion.div className="hero-art orbital-art" aria-hidden="true" initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.4}}>
  <div className="support-poster idea-poster"><span>SUPPORT ME / MONAD</span><strong>GOOD<br/>IDEAS<br/>DESERVE<br/>SUPPORT.</strong><svg className="poster-creator" viewBox="0 0 160 210" fill="none"><defs><linearGradient id="suit" x2="1" y2="1"><stop stopColor="#c095ff"/><stop offset="1" stopColor="#6d3ec3"/></linearGradient></defs><path d="M39 142Q30 164 27 199H137Q130 160 116 142" fill="url(#suit)" stroke="#dabaff" strokeWidth="2"/><path d="M58 137L53 167L79 178L106 166L101 137" fill="#9a6bdd" stroke="#d9baff" strokeWidth="2"/><ellipse cx="80" cy="87" rx="64" ry="69" fill="url(#suit)" stroke="#e2c8ff" strokeWidth="3"/><ellipse cx="80" cy="88" rx="51" ry="53" fill="#130c29" stroke="#e8d4ff" strokeWidth="3"/><path d="M37 64Q50 32 88 37" stroke="#efe4ff" strokeWidth="7" strokeLinecap="round"/><ellipse cx="60" cy="97" rx="10" ry="16" transform="rotate(-25 60 97)" fill="#d5b5ff"/><ellipse cx="100" cy="97" rx="10" ry="16" transform="rotate(25 100 97)" fill="#d5b5ff"/><path d="M68 122Q80 129 92 122M66 179V198M94 179V198" stroke="#d8bcff" strokeWidth="3" strokeLinecap="round"/><circle cx="128" cy="146" r="20" fill="#8c55de" stroke="#e8cfff" strokeWidth="2"/><path d="M119 143C118 134 129 135 128 141C132 133 142 139 135 146L127 153Z" fill="#ebd7ff"/></svg><small>PEOPLE × IDEAS × MONAD <span>↗</span></small></div>
  <div className="support-poster planet-poster"><span className="poster-stars">✦ · ✧<br/> · ✦ ·</span><div className="support-planet"><i/><b/><em/></div><strong>SMALL SUPPORT.<br/>BIG PROGRESS.</strong><small>GOOD WORK GOES ONCHAIN <span>↗</span></small></div>
 </motion.div>;
}
