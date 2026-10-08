import React from 'react';
import logoSheets from '../assets/apps/google-sheets.png';
import logoChatgpt from '../assets/apps/chatgpt.png';
import logoClaude from '../assets/apps/claude.png';
import logoMeta from '../assets/apps/meta.png';
import logoNotion from '../assets/apps/notion.png';
import logoWhatsapp from '../assets/apps/whatsapp.png';
import logoZapier from '../assets/apps/zapier.png';

// Piezas chicas de Learnation Talent (banderas, puntitos, rieles, logos). Van
// con las clases `tl-*` de `talent.css`, así que solo se ven bien dentro de
// `.dc-shell.talent`.

export const LOGO_APP = {
    'google-sheets': logoSheets,
    chatgpt: logoChatgpt,
    claude: logoClaude,
    meta: logoMeta,
    notion: logoNotion,
    whatsapp: logoWhatsapp,
    zapier: logoZapier,
};

// Banderas dibujadas con degradados: los emoji de bandera no se dibujan en
// Windows (salen como «AR», «BR»).
const FONDO_BANDERA = {
    Argentina: 'linear-gradient(180deg,#75AADB 0 33.3%,#fff 33.3% 66.6%,#75AADB 66.6%)',
    Venezuela: 'linear-gradient(180deg,#FFCC00 0 33.3%,#00247D 33.3% 66.6%,#CF142B 66.6%)',
    Brasil: '#009C3B',
    es: 'linear-gradient(180deg,#AA151B 0 25%,#F1BF00 25% 75%,#AA151B 75%)',
    en: 'linear-gradient(#C8102E,#C8102E) center/100% 20% no-repeat, linear-gradient(#C8102E,#C8102E) center/20% 100% no-repeat, linear-gradient(#fff,#fff) center/100% 36% no-repeat, linear-gradient(#fff,#fff) center/34% 100% no-repeat, linear-gradient(33deg, transparent 44%, #fff 44% 56%, transparent 56%), linear-gradient(-33deg, transparent 44%, #fff 44% 56%, transparent 56%), #012169',
};

export const Bandera = ({ de, grande = false, titulo }) => {
    if (!de || !FONDO_BANDERA[de]) return null;
    return (
        <span
            className={`tl-flag${grande ? ' tl-flag--g' : ''}`}
            style={{ background: FONDO_BANDERA[de] }}
            role="img"
            aria-label={titulo || de}
            title={titulo || de}
        >
            {de === 'Brasil' && <span className="rombo" />}
        </span>
    );
};

export const Puntos = ({ n, total = 4, seg = false }) => (
    <span className={`tl-pts${seg ? ' tl-pts--seg' : ''}`} aria-label={`${n} de ${total}`}>
        {Array.from({ length: total }, (_, j) => <i key={j} className={j < n ? 'on' : undefined} />)}
    </span>
);

export const Riel = ({ pct, color = 'var(--barra)', alto, demora = 0, className = '' }) => (
    <span className={`tl-riel ${className}`} style={alto ? { height: alto } : undefined}>
        <i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color, animationDelay: `${demora}ms` }} />
    </span>
);

export const App = ({ img, titulo, apagada = false }) => (
    <img className={`tl-app${apagada ? ' off' : ''}`} src={LOGO_APP[img]} alt={titulo} title={titulo} draggable={false} />
);

export const Inicial = ({ nombre, className = '' }) => (
    <span className={`tl-avatar ${className}`}>{(nombre || '?').trim().charAt(0).toUpperCase()}</span>
);

export const Chip = ({ c, icono: Icono, chico = false, grande = false, children, title }) => (
    <span
        className={`chip${chico ? ' chip--chico' : ''}${grande ? ' chip--g' : ''}`}
        style={c ? { '--c': c } : undefined}
        title={title}
    >
        {Icono && <Icono />}
        {children}
    </span>
);

/** El chip Híbrido/Online que acompaña a cada candidata. */
export const ChipModalidad = ({ modalidad }) => (
    <span className="chip chip--chico chip--neutro">
        {modalidad === 'hibrido' ? 'Híbrido' : 'Online'}
    </span>
);

// Isotipo de Talent: la gema blanca sobre el degradado de marca. `id` existe
// porque dos SVG con el mismo id de degradado en la página se pisan.
export const IsotipoTalent = ({ tam = 44, id = 'tlG', className = 'tl-isotipo', etiqueta = 'Learnation Talent' }) => (
    <svg className={className} width={tam} height={tam} viewBox="0 0 100 100" role="img" aria-label={etiqueta}>
        <defs>
            <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
                <stop offset="0%" stopColor="var(--tg-a)" />
                <stop offset="100%" stopColor="var(--tg-b)" />
            </linearGradient>
        </defs>
        <rect width="100" height="100" rx="26" fill={`url(#${id})`} />
        <g className="tl-gema">
            <path d="M24 40 L37 24 H63 L76 40 L50 80 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" />
            <g stroke={`url(#${id})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M24 40 H76" /><path d="M37 24 L44.5 40 L50 80" /><path d="M63 24 L55.5 40 L50 80" />
            </g>
        </g>
    </svg>
);
