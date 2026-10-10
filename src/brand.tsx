import { t, useLocale } from './i18n';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Sparkles } from 'lucide-react';
export const missionArt = (category: string) => `/art/${({ Memes: 'memes', Feedback: 'feedback', 'Bug hunting': 'testing', 'Social content': 'social', Replies: 'social', } as Record<string, string>)[category] || 'feedback'}.webp`;
export function BrandArt({ src = '/art/hero.webp', className = '', priority = false }: { src?: string; className?: string; priority?: boolean }) { useLocale(); 
 const [failed, setFailed] = useState(false);
 return failed ? <div className={`art-placeholder ${className}`}><Sparkles size={38}/><span>{t("Creator illustration")}</span></div> : <img className={className} src={src} alt="" width="1024" height="1024" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} onError={() => setFailed(true)}/>;
}
export function HeroArt() { useLocale(); 
 const reduced = useReducedMotion();
 return <motion.div className="hero-art" aria-hidden="true" initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: [.22, 1, .36, 1] }}><div className="energy-block block-one"/><div className="energy-block block-two"/><div className="culture-poster"><span>SUPPORT ME / MONAD</span><strong>{t("FOR THE")}<br/>{t("DOERS.")}</strong><div className="poster-orbit"><Sparkles size={52}/></div><small>{t("CREATE. CONTRIBUTE. CONNECT.")}</small></div><div className="art-ticket ticket-one"><BrandArt src="/art/memes.webp" priority/><span>{t("MAKE SOMETHING MATTER")} <Sparkles size={13}/></span></div><div className="art-ticket ticket-two"><BrandArt src="/art/launch.webp"/><span>{t("GOOD WORK GOES ONCHAIN")} <Sparkles size={13}/></span></div></motion.div>;
}
