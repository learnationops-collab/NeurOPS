// Crear rápido (Ctrl+N o N): elegí qué crear y te lleva a donde se crea, con el campo listo para escribir.
// Teclas 1 a 7 eligen la opción; Escape cierra.

import { useEffect, useState } from 'react';
import { Icono, Modal } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { toast } from '../../ui/toast';
import { almacen } from '../../data/hooks';
import { buscar, ord } from '../../core/datos';
import { normalPregunta } from '../../core/normalizar';

export const CREAR = [
    ['pregunta', 'Pregunta', 'pregunta'], ['formulario', 'Formulario', 'form'], ['persona', 'Persona', 'user'], ['grupo', 'Prioridad', 'rayo'],
    ['evento', 'Evento', 'calendar'], ['funnel', 'Funnel', 'funnel'],
];

// Enfoca un campo cuando aparece: las secciones se pintan después de navegar.
export function enfocarCuandoAparezca(sel, intentos = 30) {
    const paso = () => {
        const el = document.querySelector(sel);
        if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        if (--intentos > 0) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
}

function nuevaPregunta() { return normalPregunta({ tipo: 'opciones', titulo: '', opciones: [{ texto: '' }, { texto: '' }] }); }

export function crearDesdeAtajo(v) {
    almacen.flush();
    const e = ui.getState(), { d } = almacen.getState();
    ui.set({ crear: false });
    if (v === 'pregunta') {
        let fid = e.form && e.form.id;
        if (!fid || !buscar(d, 'formularios', fid)) {
            const f = ord(d, 'formularios').slice(-1)[0];
            if (!f) { crearDesdeAtajo('formulario'); toast('Primero creá un formulario.'); return; }
            fid = f.id;
        }
        const f = buscar(d, 'formularios', fid), nq = nuevaPregunta();
        almacen.editar('formularios', fid, { preguntas: [...f.preguntas, nq] }, true);
        ui.set({ seccion: 'preguntas', form: { ...(e.form && e.form.id === fid ? e.form : {}), id: fid, vista: 'preguntas', sel: nq.id } });
        enfocarCuandoAparezca('#pt-' + nq.id);
        return;
    }
    if (v === 'funnel') {
        ui.set({ funnel: {} });
        enfocarCuandoAparezca('#fm-nombre');
        return;
    }
    if (v === 'formulario') ui.set({ seccion: 'preguntas', form: null });
    if (v === 'persona' || v === 'grupo') ui.set(s => ({ seccion: 'team', team: { ...s.team, tab: v === 'persona' ? 'personas' : 'grupos' } }));
    if (v === 'evento') ui.set({ seccion: 'eventos', ev: null });
    enfocarCuandoAparezca('#nuevo-nombre');
}

export default function CrearRapido() {
    const [volver] = useState(() => document.activeElement);

    // Crear rápido reemplaza al modal del funnel si estaba abierto.
    useEffect(() => { if (ui.getState().funnel) ui.set({ funnel: null }); }, []);

    const cerrar = () => {
        ui.set({ crear: false });
        const v = volver;
        if (v && document.body.contains(v)) v.focus();
    };

    useEffect(() => {
        const tecla = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const n = +e.key;
            if (n >= 1 && n <= CREAR.length) { e.preventDefault(); crearDesdeAtajo(CREAR[n - 1][0]); return; }
            const caja = document.getElementById('crear');
            if (e.key === 'Tab' && caja) {
                const fs = [...caja.querySelectorAll('button')].filter(x => !x.disabled);
                if (!fs.length) return;
                const a = fs[0], z = fs[fs.length - 1];
                if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
                else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
            }
        };
        document.addEventListener('keydown', tecla);
        return () => document.removeEventListener('keydown', tecla);
    }, []);

    return (
        <Modal onCerrar={cerrar} id="crear" labelledBy="crear-tit" style={{ width: 'min(560px,100%)' }}>
            <div className="modal-cab" style={{ marginBottom: 'var(--s3)' }}>
                <h2 className="t-h3" id="crear-tit" style={{ flex: 1 }}>¿Qué querés crear?</h2>
                <button type="button" className="ibtn ibtn--sm" aria-label="Cerrar" onClick={cerrar}><Icono n="x" /></button>
            </div>
            <div className="crear-ops">
                {CREAR.map((c, i) => (
                    <button key={c[0]} type="button" className="crear-op" aria-keyshortcuts={String(i + 1)} onClick={() => crearDesdeAtajo(c[0])}>
                        <Icono n={c[2]} />{c[1]}<kbd>{i + 1}</kbd>
                    </button>
                ))}
            </div>
        </Modal>
    );
}
