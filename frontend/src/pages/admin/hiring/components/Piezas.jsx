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
// Windows (salen como «AR», «BR»). Versión simplificada (franjas y bloques, sin
// escudos ni estrellas): a 18 px alcanza para reconocerlas. Se buscan sin tildes
// ni mayúsculas, así «Mexico» y «México» dan la misma.
const h3 = (a, b, c) => `linear-gradient(180deg,${a} 0 33.3%,${b} 33.3% 66.6%,${c} 66.6%)`;
const v3 = (a, b, c) => `linear-gradient(90deg,${a} 0 33.3%,${b} 33.3% 66.6%,${c} 66.6%)`;
const triangulo = (c) => `linear-gradient(to bottom right,${c} 50%,transparent 50.5%) 0 0/46% 50% no-repeat, linear-gradient(to top right,${c} 50%,transparent 50.5%) 0 100%/46% 50% no-repeat`;
const BANDERAS = {
    argentina: h3('#75AADB', '#fff', '#75AADB'),
    venezuela: h3('#FFCC00', '#00247D', '#CF142B'),
    brasil: '#009C3B',
    colombia: 'linear-gradient(180deg,#FCD116 0 50%,#003893 50% 75%,#CE1126 75%)',
    ecuador: 'linear-gradient(180deg,#FFDD00 0 50%,#034EA2 50% 75%,#ED1C24 75%)',
    'costa rica': 'linear-gradient(180deg,#002B7F 0 16.6%,#fff 16.6% 33.3%,#CE1126 33.3% 66.6%,#fff 66.6% 83.3%,#002B7F 83.3%)',
    espana: 'linear-gradient(180deg,#AA151B 0 25%,#F1BF00 25% 75%,#AA151B 75%)',
    mexico: v3('#006847', '#fff', '#CE1126'),
    peru: v3('#D91023', '#fff', '#D91023'),
    guatemala: v3('#4997D0', '#fff', '#4997D0'),
    'republica dominicana': 'linear-gradient(#fff,#fff) center/100% 20% no-repeat, linear-gradient(#fff,#fff) center/16% 100% no-repeat, conic-gradient(#CE1126 0 25%,#002D62 0 50%,#CE1126 0 75%,#002D62 0)',
    panama: 'conic-gradient(#DA121A 0 25%,#fff 0 50%,#072357 0 75%,#fff 0)',
    uruguay: 'radial-gradient(circle at 19% 26%,#FCD116 0 9%,transparent 10%), linear-gradient(#fff,#fff) 0 0/38% 56% no-repeat, repeating-linear-gradient(180deg,#fff 0 11.1%,#0038A8 11.1% 22.2%)',
    chile: 'linear-gradient(#0039A6,#0039A6) 0 0/34% 50% no-repeat, linear-gradient(180deg,#fff 0 50%,#D52B1E 50%)',
    paraguay: h3('#D52B1E', '#fff', '#0038A8'),
    bolivia: h3('#D52B1E', '#F9E300', '#007934'),
    honduras: h3('#0073CF', '#fff', '#0073CF'),
    'el salvador': h3('#0F47AF', '#fff', '#0F47AF'),
    nicaragua: h3('#0067C6', '#fff', '#0067C6'),
    'estados unidos': 'linear-gradient(#3C3B6E,#3C3B6E) 0 0/42% 54% no-repeat, repeating-linear-gradient(180deg,#B22234 0 7.69%,#fff 7.69% 15.38%)',
    'puerto rico': `${triangulo('#0050F0')}, repeating-linear-gradient(180deg,#ED0000 0 20%,#fff 20% 40%)`,
    cuba: `${triangulo('#CF142B')}, repeating-linear-gradient(180deg,#002A8F 0 20%,#fff 20% 40%)`,
    alemania: h3('#000', '#DD0000', '#FFCE00'),
    suiza: 'linear-gradient(#fff,#fff) center/62% 22% no-repeat, linear-gradient(#fff,#fff) center/22% 62% no-repeat, #D52B1E',
    albania: '#E41E20',
    angola: 'linear-gradient(180deg,#CC092F 0 50%,#000 50%)',
    afganistan: v3('#000', '#D32011', '#007A36'),
    italia: v3('#009246', '#fff', '#CE2B37'),
    francia: v3('#0055A4', '#fff', '#EF4135'),
    portugal: 'linear-gradient(90deg,#006600 0 40%,#FF0000 40%)',
    // Idiomas (inglés y español) de las columnas de idiomas.
    en: 'linear-gradient(#C8102E,#C8102E) center/100% 20% no-repeat, linear-gradient(#C8102E,#C8102E) center/20% 100% no-repeat, linear-gradient(#fff,#fff) center/100% 36% no-repeat, linear-gradient(#fff,#fff) center/34% 100% no-repeat, linear-gradient(33deg, transparent 44%, #fff 44% 56%, transparent 56%), linear-gradient(-33deg, transparent 44%, #fff 44% 56%, transparent 56%), #012169',
};
BANDERAS.es = BANDERAS.espana;

const clave = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Cualquier país con nombre tiene bandera; uno que no está en la lista («Otro…») lleva una neutra. */
export const Bandera = ({ de, grande = false, titulo }) => {
    if (!de || clave(de) === 'sin pais') return null;
    const fondo = BANDERAS[clave(de)];
    return (
        <span
            className={`tl-flag${grande ? ' tl-flag--g' : ''}${fondo ? '' : ' tl-flag--otro'}`}
            style={fondo ? { background: fondo } : undefined}
            role="img"
            aria-label={titulo || de}
            title={titulo || de}
        >
            {clave(de) === 'brasil' && <span className="rombo" />}
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
