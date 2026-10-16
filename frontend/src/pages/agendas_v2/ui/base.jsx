// Piezas de interfaz compartidas por todas las secciones. Usan las clases de thalamus.css tal cual
// las define el prototipo, así que el aspecto es el mismo.

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { Avatar as AvatarStd, BRAND_AURA, Modal as ModalStd, Segmented, Select, Stepper, Switch as SwitchStd } from '../../../components/standard';
import { BANDERAS, ICON, MEET_SVG } from './iconos';
import { cerrarToast, toastStore } from './toast';
import { colorVar } from '../core/datos';

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

// Fondo de nubes propio de Thalamus (con sus variantes por contexto: dock, kpi, lead). El de los
// componentes estándar es Aura (components/standard).
export const HUMO_MARCA = BRAND_AURA;
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

// Los controles se dibujan con los componentes estándar (components/standard). Estos adaptadores
// traducen la forma de Thalamus (opciones {v, n, icono}, nombres de íconos, `nav`) a la de ellos. Código
// nuevo: usá los estándar directamente.
const TAM_AVATAR = { 'avatar--l': 'lg', 'avatar--sm': 'sm', 'avatar--xs': 'xs' };
export function Avatar({ p, clase = '', foto = true }) {
    const partes = clase.split(/\s+/).filter(Boolean);
    const tam = partes.map(c => TAM_AVATAR[c]).find(Boolean) || 'md';
    const resto = partes.filter(c => !TAM_AVATAR[c]).join(' ');
    return <AvatarStd name={p.nombre} photo={foto ? p.foto : null} color={colorVar(p.color)} size={tam} className={resto || undefined} />;
}

export function Switch({ on, onChange, label, disabled, id }) {
    return <SwitchStd id={id} checked={on} onChange={onChange} label={label} disabled={disabled} />;
}

// Grupo de botones excluyentes. opciones: [{v, n, icono}]
export function Seg({ valor, opciones, onChange, sm, label, nav }) {
    return (
        <Segmented value={valor} onChange={onChange} size={sm ? 'sm' : 'md'} label={label} itemProps={nav ? { 'data-nav': '' } : undefined}
            options={opciones.map(o => ({ value: o.v, label: o.n, icon: o.icono && <Icono n={o.icono} /> }))} />
    );
}

// Contador con − y +.
export function Paso({ valor, min, max, onChange, texto, label, disabled }) {
    return <Stepper value={valor} min={min} max={max} onChange={onChange} display={texto} label={label} disabled={disabled} />;
}

// Desplegable. opciones: [{v, n, icono?, color?}]. v '' = opción vacía.
export function Sx({ valor, opciones, onChange, sm, label, id, style, disabled, nav }) {
    return (
        <Select value={valor} onChange={onChange} size={sm ? 'sm' : 'md'} label={label} id={id} style={style} disabled={disabled}
            data-nav={nav ? '' : undefined}
            options={opciones.map(o => ({ value: o.v, label: o.n, icon: o.icono && <Icono n={o.icono} s={15} />, iconColor: o.color }))} />
    );
}

// Ventana modal: cierra con Escape o clic en el fondo y bloquea el scroll de la página.
export function Modal({ onCerrar, clase = '', style, labelledBy, children, id }) {
    return <ModalStd onClose={onCerrar} className={clase || undefined} style={style} labelledBy={labelledBy} id={id}>{children}</ModalStd>;
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
