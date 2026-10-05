// Piezas de interfaz compartidas por todas las secciones. Usan las clases de thalamus.css tal cual
// las define el prototipo, así que el aspecto es el mismo.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BANDERAS, ICON, MEET_SVG } from './iconos';
import { cerrarToast, toastStore } from './toast';
import { colorVar } from '../core/datos';
import { iniciales } from '../core/util';

// SVG fijos del código (nunca datos de usuarios): por eso se pueden inyectar.
export function Icono({ n, s = 16, style, className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            width={s} height={s} aria-hidden="true" style={style} className={className} dangerouslySetInnerHTML={{ __html: ICON[n] || '' }} />
    );
}
export function MeetLogo() { return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: MEET_SVG }} />; }
export function Bandera({ c }) {
    if (!BANDERAS[c]) return null;
    return <span className="bandera" aria-hidden="true"><svg viewBox="0 0 30 20" preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: BANDERAS[c] }} /></span>;
}

export const HUMO_MARCA = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--brand-navy)'];
export function Humo({ clase = '', cols = HUMO_MARCA }) {
    const style = {};
    cols.forEach((c, i) => { style['--h' + (i + 1)] = c; });
    return <span className={'humo' + (clase ? ' ' + clase : '')} aria-hidden="true" style={style}><i /><i /><i /><i /></span>;
}

// Isotipo de Configuración (el dial).
export function Dial({ tile = false, className = '', label }) {
    return (
        <svg className={'sg-tile' + (className ? ' ' + className : '')} viewBox="0 0 100 100" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
            {tile && <rect className="sg-fondo" width="100" height="100" rx="26" />}
            <g fill="#FFFFFF" opacity=".55">
                <circle cx="23.15" cy="65.5" r="3.4" /><circle cx="19.47" cy="44.6" r="3.4" /><circle cx="30.07" cy="26.25" r="3.4" />
                <circle cx="50" cy="19" r="3.4" /><circle cx="80.53" cy="44.6" r="3.4" /><circle cx="76.85" cy="65.5" r="3.4" />
            </g>
            <circle cx="69.93" cy="26.25" r="3.4" fill="#FFFFFF" />
            <g className="sg-perilla"><circle cx="50" cy="50" r="21" fill="#FFFFFF" /><line className="sg-muesca" x1="50" y1="49" x2="50" y2="35" strokeWidth="6" strokeLinecap="round" /></g>
        </svg>
    );
}
export function LogoThalamus({ className = 'tope-logo tl-logo' }) {
    return (
        <svg className={className} viewBox="0 0 100 100" role="img" aria-label="Learnation Thalamus">
            <defs><linearGradient id="tlG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FF3FA4" /><stop offset="100%" stopColor="#FF6AD5" /></linearGradient></defs>
            <rect className="tl-fondo" width="100" height="100" rx="26" />
            <path d="M59.5 23.5 A28 28 0 1 1 40.5 23.5" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
            <line x1="29" y1="50" x2="71" y2="50" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
            <circle cx="50" cy="50" r="8.5" fill="#FFFFFF" />
        </svg>
    );
}

export function Avatar({ p, clase = '', foto = true }) {
    const f = foto && p.foto;
    return (
        <span className={'avatar' + (clase ? ' ' + clase : '')} aria-hidden="true" style={{ '--c': colorVar(p.color), ...(f ? { position: 'relative', overflow: 'hidden' } : {}) }}>
            {f ? <img src={p.foto} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciales(p.nombre)}
        </span>
    );
}

export function Chip({ c = 'var(--text-muted)', icono, children, clase = '', title }) {
    return <span className={'chip' + (clase ? ' ' + clase : '')} style={{ '--c': c }} title={title}>{icono && <Icono n={icono} s={13} />}{children}</span>;
}

export function Switch({ on, onChange, label, disabled, id }) {
    return <button type="button" id={id} className="switch" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}

// Grupo de botones excluyentes. opciones: [{v, n, icono}]
export function Seg({ valor, opciones, onChange, sm, label, nav }) {
    return (
        <div className={'seg' + (sm ? ' seg--sm' : '')} role="group" aria-label={label}>
            {opciones.map(o => (
                <button key={o.v} type="button" aria-pressed={valor === o.v} data-nav={nav ? '' : undefined} onClick={() => onChange(o.v)}>
                    {o.icono && <Icono n={o.icono} />}{o.n}
                </button>
            ))}
        </div>
    );
}

// Contador con − y +.
export function Paso({ valor, min, max, onChange, texto, label, disabled }) {
    return (
        <span className="paso" role="group" aria-label={label}>
            <button type="button" aria-label="Menos" disabled={disabled || valor <= min} onClick={() => onChange(Math.max(min, valor - 1))}><Icono n="minus" /></button>
            <b>{texto ?? valor}</b>
            <button type="button" aria-label="Más" disabled={disabled || valor >= max} onClick={() => onChange(Math.min(max, valor + 1))}><Icono n="plus" /></button>
        </span>
    );
}

/**
 * Desplegable propio (el del prototipo). opciones: [{v, n, icono?, color?}]. v '' = opción vacía.
 * Teclado: flechas, Home/End, Enter/Espacio, Escape, y escribir para saltar.
 */
export function Sx({ valor, opciones, onChange, sm, label, id, style, disabled, nav }) {
    const [abierto, setAbierto] = useState(false);
    const [act, setAct] = useState(0);
    const btn = useRef(null), pop = useRef(null), buscar = useRef({ s: '', t: null });
    const idx = Math.max(0, opciones.findIndex(o => o.v === valor));
    const sel = opciones[idx];

    const cerrar = useCallback((foco) => { setAbierto(false); if (foco && btn.current) btn.current.focus(); }, []);
    const elegir = (i) => { cerrar(true); const o = opciones[i]; if (o && o.v !== valor) onChange(o.v); };

    useLayoutEffect(() => {
        if (!abierto || !pop.current || !btn.current) return;
        const r = btn.current.getBoundingClientRect(), el = pop.current;
        el.style.minWidth = Math.max(180, r.width) + 'px';
        const h = el.offsetHeight;
        el.style.top = ((window.innerHeight - r.bottom < h + 12 && r.top > h + 12) ? r.top - h - 6 : r.bottom + 6) + 'px';
        el.style.left = Math.max(8, Math.min(r.left, window.innerWidth - el.offsetWidth - 8)) + 'px';
    }, [abierto]);
    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => { if (!pop.current?.contains(e.target) && !btn.current?.contains(e.target)) cerrar(false); };
        const scroll = (e) => { if (!pop.current?.contains(e.target)) cerrar(false); };
        document.addEventListener('mousedown', fuera, true);
        window.addEventListener('scroll', scroll, true);
        window.addEventListener('resize', () => cerrar(false), { once: true });
        return () => { document.removeEventListener('mousedown', fuera, true); window.removeEventListener('scroll', scroll, true); };
    }, [abierto, cerrar]);
    useEffect(() => { if (abierto) pop.current?.querySelectorAll('.sx-op')[act]?.scrollIntoView({ block: 'nearest' }); }, [act, abierto]);

    const tecla = (e) => {
        if (!abierto) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAct(idx); setAbierto(true); }
            return;
        }
        const n = opciones.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); setAct(a => Math.min(n - 1, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(a => Math.max(0, a - 1)); }
        else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setAct(e.key === 'Home' ? 0 : n - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(act); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(true); }
        else if (e.key === 'Tab') cerrar(false);
        else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const b = buscar.current; clearTimeout(b.t); b.s += e.key.toLowerCase(); b.t = setTimeout(() => { b.s = ''; }, 600);
            const i = opciones.findIndex(o => String(o.n).toLowerCase().startsWith(b.s));
            if (i >= 0) setAct(i);
        }
    };

    return (
        <>
            <button ref={btn} type="button" id={id} className={'sx' + (sm ? ' sx--sm' : '')} style={style} aria-haspopup="listbox" aria-expanded={abierto}
                aria-label={label} disabled={disabled} data-nav={nav ? '' : undefined}
                onClick={() => { if (abierto) cerrar(false); else { setAct(idx); setAbierto(true); } }} onKeyDown={tecla}>
                {sel && sel.icono && <Icono n={sel.icono} s={15} style={{ color: sel.color || 'var(--brand-secondary)' }} />}
                <span className={'sx-v' + (sel && !sel.v ? ' sx-v--vacio' : '')}>{sel ? sel.n : ''}</span>
                <Icono n="chevron-down" s={14} />
            </button>
            {abierto && (
                <div ref={pop} className="sx-pop" role="listbox" aria-label={label} style={{ top: -9999, left: -9999 }}>
                    {opciones.map((o, i) => (
                        <button key={o.v + '|' + i} type="button" className={'sx-op' + (!o.v ? ' sx-op--vacio' : '') + (i === act ? ' activo' : '')} role="option"
                            aria-selected={i === idx} tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => elegir(i)} onMouseEnter={() => setAct(i)}>
                            {o.icono && <Icono n={o.icono} s={15} style={{ color: o.color || 'var(--text-muted-40)' }} />}
                            <span>{o.n}</span>
                            <Icono n="check" s={15} />
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}

/**
 * Ventana modal sobre un fondo oscuro. Cierra con Escape o clic en el fondo.
 * Bloquea el scroll de la página mientras está abierta.
 */
export function Modal({ onCerrar, clase = '', style, labelledBy, children, id }) {
    const ref = useRef(null);
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const esc = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onCerrar(); } };
        document.addEventListener('keydown', esc);
        const foco = ref.current?.querySelector('input,textarea,button:not(.ibtn)') || ref.current;
        foco?.focus({ preventScroll: true });
        return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div ref={ref} id={id} className={'modal' + (clase ? ' ' + clase : '')} style={style} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
                {children}
            </div>
        </div>
    );
}

export function Toasts() {
    const t = useSyncExternalStore(toastStore.subscribe, toastStore.getState);
    if (!t) return null;
    return (
        <div className="toast" role="status" data-tono={t.tono} key={t.id}>
            <Icono n={t.tono === 'error' ? 'alerta' : 'check'} s={16} />
            <span>{t.texto}</span>
            {t.accion && <button type="button" className="toast-acc" onClick={() => { cerrarToast(); t.accion.fn(); }}>{t.accion.txt}</button>}
        </div>
    );
}

// Tooltip global: cualquier elemento con data-tip="Título|detalle" lo muestra al pasar el mouse.
export function Tooltip() {
    const ref = useRef(null);
    useEffect(() => {
        const tip = ref.current;
        const sobre = (e) => {
            const t = e.target.closest && e.target.closest('[data-tip]');
            if (!t) { tip.hidden = true; return; }
            const [a, b] = t.getAttribute('data-tip').split('|');
            tip.textContent = a;
            if (b) { const s = document.createElement('span'); s.textContent = b; tip.appendChild(s); }
            tip.hidden = false;
        };
        const mover = (e) => { if (!tip.hidden) { tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 16) + 'px'; } };
        document.addEventListener('mouseover', sobre);
        document.addEventListener('mousemove', mover);
        return () => { document.removeEventListener('mouseover', sobre); document.removeEventListener('mousemove', mover); };
    }, []);
    return <div className="tip" ref={ref} hidden />;
}

// Textarea que crece con el contenido (class "area").
export function AreaAuto({ value, onChange, className = 'area', ...rest }) {
    const ref = useRef(null);
    useLayoutEffect(() => { const t = ref.current; if (t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; } }, [value]);
    return <textarea ref={ref} className={className} value={value} onChange={onChange} rows={1} {...rest} />;
}

// Achica una imagen a 256 px y la devuelve como dato (data URL), para guardarla sin archivos externos.
export function leerFoto(file) {
    return new Promise((ok, mal) => {
        if (!file || !/^image\//.test(file.type)) { mal(new Error('Elegí una imagen.')); return; }
        const rd = new FileReader();
        rd.onload = () => {
            const im = new Image();
            im.onload = () => {
                const lado = 256, c = document.createElement('canvas'), k = Math.max(lado / im.width, lado / im.height), w = im.width * k, h = im.height * k;
                c.width = lado; c.height = lado;
                c.getContext('2d').drawImage(im, (lado - w) / 2, (lado - h) / 2, w, h);
                ok(c.toDataURL('image/jpeg', 0.85));
            };
            im.onerror = () => mal(new Error('No se pudo leer la imagen.'));
            im.src = rd.result;
        };
        rd.readAsDataURL(file);
    });
}
