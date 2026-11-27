// La manija para mover un poco los costados del Inbox (Mario, 27/11/2026): la lista a la izquierda y la columna del
// lead a la derecha. Va adentro del panel, en el borde que da al chat; arrastrarla cambia `--cv-izq` o `--cv-der` en
// `.cv` (sin pasar por React, cuadro a cuadro) y al soltar se guarda en este navegador. Doble clic, o Inicio, vuelve
// al ancho de siempre; con las flechas se mueve de a 16 px.
import { useState } from 'react';

export const ANCHOS = {
    izq: { variable: '--cv-izq', min: 260, max: 440, base: 360 },
    der: { variable: '--cv-der', min: 260, max: 380, base: 290 },
};
const clave = (lado) => `cv_ancho_${lado}`;
const limitar = (a, w) => Math.round(Math.min(a.max, Math.max(a.min, w)));

// Los anchos guardados, para el `style` de `.cv` al montar.
export function anchosGuardados() {
    const s = {};
    Object.entries(ANCHOS).forEach(([lado, a]) => {
        const v = Number(localStorage.getItem(clave(lado)));
        if (v >= a.min && v <= a.max) s[a.variable] = `${v}px`;
    });
    return s;
}

export default function Tirador({ lado }) {
    const a = ANCHOS[lado];
    const [activo, setActivo] = useState(false);
    const poner = (el, w) => {
        el.closest('.cv')?.style.setProperty(a.variable, `${w}px`);
        localStorage.setItem(clave(lado), String(w));
    };
    const bajar = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const manija = e.currentTarget;
        const cv = manija.closest('.cv');
        const x0 = e.clientX;
        const w0 = manija.parentElement.getBoundingClientRect().width;
        let w = w0;
        setActivo(true);
        document.body.classList.add('cv-arrastrando');
        const mover = (ev) => {
            const dx = ev.clientX - x0;
            w = limitar(a, w0 + (lado === 'izq' ? dx : -dx));
            cv?.style.setProperty(a.variable, `${w}px`);
        };
        const soltar = () => {
            window.removeEventListener('pointermove', mover);
            window.removeEventListener('pointerup', soltar);
            setActivo(false);
            document.body.classList.remove('cv-arrastrando');
            localStorage.setItem(clave(lado), String(w));
        };
        window.addEventListener('pointermove', mover);
        window.addEventListener('pointerup', soltar);
    };
    const volver = (e) => {
        e.currentTarget.closest('.cv')?.style.setProperty(a.variable, `${a.base}px`);
        localStorage.removeItem(clave(lado));
    };
    const tecla = (e) => {
        const el = e.currentTarget;
        const w = el.parentElement.getBoundingClientRect().width;
        const paso = (e.key === 'ArrowRight' ? 16 : e.key === 'ArrowLeft' ? -16 : 0) * (lado === 'izq' ? 1 : -1);
        if (paso) { e.preventDefault(); poner(el, limitar(a, w + paso)); }
        if (e.key === 'Home') { e.preventDefault(); volver(e); }
    };
    return (
        <span role="separator" aria-orientation="vertical" aria-label={lado === 'izq' ? 'Ancho de la lista' : 'Ancho de la columna del lead'}
            tabIndex={0} className={`cv-tirador cv-tirador--${lado}${activo ? ' is-activo' : ''}`}
            onPointerDown={bajar} onDoubleClick={volver} onKeyDown={tecla}
            data-tip={activo ? undefined : 'Ancho|Arrastrá para moverlo · doble clic, el de siempre'}>
            <i aria-hidden="true" />
        </span>
    );
}
