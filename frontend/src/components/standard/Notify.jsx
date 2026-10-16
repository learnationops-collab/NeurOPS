// Avisos y ayudas globales: toast() muestra un aviso corto abajo de la pantalla (con <Toaster /> montado
// una vez en la app) y <Tooltip /> muestra el título y el detalle de cualquier elemento con
// data-tip="Título|detalle" al pasar el mouse.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import './standard.css';

let actual = null, timer = null;
const subs = new Set();
const emitir = () => subs.forEach(fn => fn());
const store = { subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }, getState: () => actual };

// tone: success · error. action: { label, onClick } (por ejemplo «Deshacer»): el aviso dura 6 s.
export function toast(text, tone = 'success', action = null) {
    clearTimeout(timer);
    actual = { text, tone, action, id: Date.now() };
    emitir();
    timer = setTimeout(() => { actual = null; emitir(); }, action ? 6000 : tone === 'error' ? 5200 : 2400);
}
export function closeToast() { clearTimeout(timer); actual = null; emitir(); }

const ICONO = {
    success: <path d="M20 6 9 17l-5-5" />,
    error: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
};

export function Toaster() {
    const t = useSyncExternalStore(store.subscribe, store.getState);
    if (!t) return null;
    return (
        <div className="ui-toast" role="status" data-tone={t.tone} key={t.id}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                width={16} height={16} aria-hidden="true">{ICONO[t.tone] || ICONO.success}</svg>
            <span>{t.text}</span>
            {t.action && <button type="button" className="ui-toast__action" onClick={() => { closeToast(); t.action.onClick(); }}>{t.action.label}</button>}
        </div>
    );
}

// Un solo Tooltip por pantalla: escucha el mouse en todo el documento.
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
    return <div className="ui-tip" ref={ref} hidden />;
}
