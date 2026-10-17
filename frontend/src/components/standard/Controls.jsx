// Controles estándar: pestañas (Segmented), desplegable (Select), interruptor (Switch), contador
// (Stepper), ventana modal (Modal) y avatar (Avatar).
// Base: los controles de Thalamus (ui/base.jsx), con el mismo comportamiento y teclado.

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { IconButton } from './Button';
import './standard.css';

// Íconos propios (Lucide, trazo 1.75): un componente estándar no depende del set de una pantalla.
function Svg({ d, s = 16 }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            width={s} height={s} aria-hidden="true"><path d={d} /></svg>
    );
}
const CHEVRON = 'm6 9 6 6 6-6', CHECK = 'M20 6 9 17l-5-5', MINUS = 'M5 12h14', PLUS = 'M12 5v14M5 12h14';

// Botones excluyentes (pestañas, períodos, vistas). options: [{ value, label, icon, props }]: `props` va
// a ese botón (title, aria-label de uno de solo ícono, style). `itemProps` va a todos (en Thalamus,
// data-nav para que sigan activos en solo lectura). `prefix` se dibuja antes de las opciones. `radio`
// lo anuncia como grupo de radio (una elección entre varias) en lugar de botones.
export function Segmented({ value, options, onChange, size = 'md', orientation = 'horizontal', label, itemProps, prefix, radio = false, className, ...rest }) {
    return (
        <div className={clsx('ui-seg', size === 'sm' && 'ui-seg--sm', orientation === 'vertical' && 'ui-seg--vertical', className)}
            role={radio ? 'radiogroup' : 'group'} aria-label={label} aria-orientation={orientation === 'vertical' ? 'vertical' : undefined} {...rest}>
            {prefix}
            {options.map(o => (
                <button key={o.value} type="button" className="ui-seg__item" aria-pressed={value === o.value}
                    {...(radio ? { role: 'radio', 'aria-checked': value === o.value } : null)} {...itemProps} {...o.props} onClick={() => onChange(o.value)}>
                    {o.icon}{o.label}
                    {/* El espacio separa la cuenta en el nombre accesible («Esperan 13»); en el flex no se ve. */}
                    {o.count != null && <> <span className="ui-seg__count">{o.count}</span></>}
                </button>
            ))}
        </div>
    );
}

/**
 * Desplegable propio. options: [{ value, label, icon?, iconColor? }]; value '' = opción vacía.
 * Teclado: flechas, Home/End, Enter/Espacio, Escape y escribir para saltar. Los atributos extra van
 * al botón; si lleva data-nav, también las opciones (para que sigan activas en solo lectura).
 */
export function Select({ value, options, onChange, size = 'md', label, id, style, disabled, className, ...rest }) {
    const [abierto, setAbierto] = useState(false);
    const [act, setAct] = useState(0);
    const btn = useRef(null), pop = useRef(null), buscar = useRef({ s: '', t: null });
    const idx = Math.max(0, options.findIndex(o => o.value === value));
    const sel = options[idx];
    const nav = rest['data-nav'];

    const cerrar = useCallback((foco) => { setAbierto(false); if (foco && btn.current) btn.current.focus(); }, []);
    const elegir = (i) => { cerrar(true); const o = options[i]; if (o && o.value !== value) onChange(o.value); };

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
    useEffect(() => { if (abierto) pop.current?.querySelectorAll('.ui-select__option')[act]?.scrollIntoView({ block: 'nearest' }); }, [act, abierto]);

    const tecla = (e) => {
        if (!abierto) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAct(idx); setAbierto(true); }
            return;
        }
        const n = options.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); setAct(a => Math.min(n - 1, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(a => Math.max(0, a - 1)); }
        else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setAct(e.key === 'Home' ? 0 : n - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(act); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(true); }
        else if (e.key === 'Tab') cerrar(false);
        else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const b = buscar.current; clearTimeout(b.t); b.s += e.key.toLowerCase(); b.t = setTimeout(() => { b.s = ''; }, 600);
            const i = options.findIndex(o => String(o.label).toLowerCase().startsWith(b.s));
            if (i >= 0) setAct(i);
        }
    };

    return (
        <>
            <button ref={btn} type="button" id={id} className={clsx('ui-select', size === 'sm' && 'ui-select--sm', className)} style={style}
                aria-haspopup="listbox" aria-expanded={abierto} aria-label={label} disabled={disabled} {...rest}
                onClick={() => { if (abierto) cerrar(false); else { setAct(idx); setAbierto(true); } }} onKeyDown={tecla}>
                {sel && sel.icon && <span className="ui-select__icon" style={{ color: sel.iconColor || 'var(--ui-brand)' }}>{sel.icon}</span>}
                <span className={clsx('ui-select__value', sel && !sel.value && 'ui-select__value--empty')}>{sel ? sel.label : ''}</span>
                <Svg d={CHEVRON} s={14} />
            </button>
            {abierto && (
                <div ref={pop} className="ui-select__pop" role="listbox" aria-label={label} style={{ top: -9999, left: -9999 }}>
                    {options.map((o, i) => (
                        <button key={o.value + '|' + i} type="button" role="option" aria-selected={i === idx} tabIndex={-1} data-nav={nav}
                            className={clsx('ui-select__option', !o.value && 'ui-select__option--empty', i === act && 'is-active')}
                            onMouseDown={e => e.preventDefault()} onClick={() => elegir(i)} onMouseEnter={() => setAct(i)}>
                            {o.icon && <span className="ui-select__icon" style={{ color: o.iconColor || 'var(--ui-faint)' }}>{o.icon}</span>}
                            <span className="ui-select__label">{o.label}</span>
                            <Svg d={CHECK} s={15} />
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}

export const Switch = forwardRef(function Switch({ checked, onChange, label, className, ...rest }, ref) {
    return (
        <button ref={ref} type="button" className={clsx('ui-switch', className)} role="switch" aria-checked={!!checked} aria-label={label}
            {...rest} onClick={() => onChange(!checked)} />
    );
});

// Contador con − y +. `display` reemplaza al número (por ejemplo «30 min»).
export function Stepper({ value, min, max, onChange, display, label, disabled, className }) {
    return (
        <span className={clsx('ui-stepper', className)} role="group" aria-label={label}>
            <button type="button" className="ui-stepper__btn" aria-label="Menos" disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Svg d={MINUS} /></button>
            <b className="ui-stepper__value">{display ?? value}</b>
            <button type="button" className="ui-stepper__btn" aria-label="Más" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Svg d={PLUS} /></button>
        </span>
    );
}

/**
 * Ventana modal sobre un fondo oscuro. Cierra con Escape o clic en el fondo, bloquea el scroll de la
 * página y enfoca el primer campo (o botón que no sea de solo ícono).
 */
export function Modal({ onClose, className, style, labelledBy, id, children }) {
    const ref = useRef(null);
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const esc = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
        document.addEventListener('keydown', esc);
        const foco = ref.current?.querySelector('input,textarea,button:not(.ibtn):not(.ui-ibtn)') || ref.current;
        foco?.focus({ preventScroll: true });
        return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="ui-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={ref} id={id} className={clsx('ui-modal', className)} style={style} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
                {children}
            </div>
        </div>
    );
}

// Cabecera de un modal: ícono (opcional), título y subtítulo, y el botón de cerrar. size: md · lg.
// `titleId` va en el título, para el aria-labelledby del Modal. `closeProps` va al botón de cerrar.
export function ModalHeader({ icon, title, subtitle, titleId, size = 'md', onClose, closeProps, className, style }) {
    return (
        <div className={clsx('ui-modal-head', size === 'lg' && 'ui-modal-head--lg', className)} style={style}>
            {icon}
            <div className="ui-modal-head__text">
                <h2 className="ui-modal-head__title" id={titleId}>{title}</h2>
                {subtitle && <p className="ui-modal-head__sub">{subtitle}</p>}
            </div>
            {onClose && <IconButton label="Cerrar" icon={<Svg d="M18 6 6 18M6 6l12 12" />} size={size === 'lg' ? 'md' : 'sm'} onClick={onClose} {...closeProps} />}
        </div>
    );
}

export function initials(name) {
    const p = String(name || '').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p[1] || '').charAt(0)).toUpperCase();
}

// Avatar: foto o iniciales sobre el color de la persona. size: md · lg · sm · xs.
export function Avatar({ name, photo, color, size = 'md', className, children }) {
    return (
        <span className={clsx('ui-avatar', size !== 'md' && 'ui-avatar--' + size, photo && 'ui-avatar--photo', className)} aria-hidden="true"
            style={color ? { '--c': color } : undefined}>
            {photo ? <img src={photo} alt="" className="ui-avatar__img" /> : (children ?? initials(name))}
        </span>
    );
}
