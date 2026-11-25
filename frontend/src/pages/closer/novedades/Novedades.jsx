import React, { useEffect, useState } from 'react';
import { ArrowRight, X, Sparkles, PanelRight, CalendarDays, UserSquare2, CheckCircle2, CalendarClock, Clock } from 'lucide-react';
import { VERSION, FECHA, PORTADA, PASOS } from './contenido';
import Recorrido from './Recorrido';
import { useCuenta } from './Mocks';
// La huella del recorrido (ADR-W222): cambia sola con cualquier cambio de contenido, escenas o recorrido, así
// el changelog nuevo le vuelve a aparecer a todos (también a quien ya lo terminó) sin tocar VERSION a mano.
import fuenteContenido from './contenido.js?raw';
import fuenteMocks from './Mocks.jsx?raw';
import fuenteRecorrido from './Recorrido.jsx?raw';
import './novedades.css';

// Las novedades del Workspace de closers y triage (ADR-W218). La primera vez que alguien entra
// después de una tanda nueva (VERSION) ve la portada a pantalla completa; «Mostrame» arranca el
// recorrido por los lugares reales de Work. Queda visto recién al terminar el último paso (si se
// recarga a la mitad, vuelve a empezar). «Después» (ADR-W225) lo deja hasta el día siguiente, durante
// 3 días desde que apareció; pasado ese plazo es obligatorio: sin cruz, «Después» ni Esc. Ya visto,
// se puede volver a abrir (y cerrar) desde Herramientas › Novedades o con `?novedades=1`.

const EVENTO = 'ln:novedades';
const huella = (t) => { let h = 5381; for (let k = 0; k < t.length; k += 1) h = ((h << 5) + h + t.charCodeAt(k)) | 0; return (h >>> 0).toString(36); };
const VISTA = `${VERSION}-${huella(fuenteContenido + fuenteMocks + fuenteRecorrido)}`;
const clave = (user) => `ln_novedades_${user?.id ?? 'anon'}`;
const PLAZO_DIAS = 3;
const DIA = 86400000;

// Aplazos de esta tanda: `desde` es la primera vez que apareció y `hasta`, hasta cuándo se aplazó.
const leerAplazo = (user) => {
    let a = null;
    try { a = JSON.parse(localStorage.getItem(`${clave(user)}_aplazo`)); } catch { a = null; }
    if (a?.vista === VISTA) return a;
    a = { vista: VISTA, desde: Date.now(), hasta: 0 };
    localStorage.setItem(`${clave(user)}_aplazo`, JSON.stringify(a));
    return a;
};
const diasQueQuedan = (a) => Math.max(0, Math.ceil((a.desde + PLAZO_DIAS * DIA - Date.now()) / DIA));
const aplazar = (user) => {
    const a = leerAplazo(user);
    const manana = new Date(); manana.setHours(24, 0, 0, 0);
    a.hasta = Math.min(manana.getTime(), a.desde + PLAZO_DIAS * DIA);
    localStorage.setItem(`${clave(user)}_aplazo`, JSON.stringify(a));
};

export const abrirNovedades = () => window.dispatchEvent(new Event(EVENTO));

const ICONOS = { riel: PanelRight, calendario: CalendarDays, tarjeta: UserSquare2, confirmacion: CheckCircle2, reprogramar: CalendarClock, horario: Clock };

const Portada = ({ obligatorio, quedan, onEmpezar, onDespues }) => {
    const n = useCuenta(PORTADA.length, 900, 700);
    useEffect(() => {
        const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (!obligatorio) onDespues(); } };
        window.addEventListener('keydown', tecla, true);
        return () => window.removeEventListener('keydown', tecla, true);
    }, [obligatorio, onDespues]);
    return (
        <div className="nv-portada" role="dialog" aria-modal="true" aria-label="Novedades de Work">
            <span className="nv-humo" aria-hidden="true"><i /><i /><i /><i /></span>
            {!obligatorio && <button type="button" className="nv-portada__x" onClick={onDespues} aria-label="Cerrar"><X /></button>}
            <div className="nv-portada__centro">
                <span className="nv-chip"><i />Novedades · {FECHA}</span>
                <h1 className="nv-h1">
                    <span style={{ '--d': '250ms' }}>Hay novedades</span>
                    <span style={{ '--d': '550ms' }} className="is-tono">en Work.</span>
                </h1>
                <div className="nv-portada__cuenta"><b>{n}</b><em>cambios para tu día</em></div>
                <div className="nv-portada__iconos">
                    {PORTADA.map((p, k) => {
                        const Icono = ICONOS[p.id] || Sparkles;
                        return (
                            <span key={p.id} style={{ '--k': k }}>
                                <i><Icono aria-hidden="true" /></i>
                                <em>{p.label}</em>
                            </span>
                        );
                    })}
                </div>
                <div className="nv-portada__acciones">
                    <button type="button" className="nv-cta" onClick={onEmpezar} autoFocus>
                        <span className="nv-cta__aura" aria-hidden="true"><i /><i /><i /></span>
                        <span>Mostrame</span><ArrowRight aria-hidden="true" />
                    </button>
                    {!obligatorio && (
                        <button type="button" className="nv-despues" onClick={onDespues}>
                            {quedan ? <>Después<small>{quedan === 1 ? 'último día' : `quedan ${quedan} días`}</small></> : 'Cerrar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const Novedades = ({ user, ctx }) => {
    const [fase, setFase] = useState(null);
    const vista = () => localStorage.getItem(clave(user)) === VISTA;
    // Sin terminar, se puede aplazar mientras queden días del plazo (`quedan`); después, obligatorio.
    const [quedan, setQuedan] = useState(0);
    const [obligatorio, setObligatorio] = useState(true);
    const abrir = () => {
        const dias = vista() ? 0 : diasQueQuedan(leerAplazo(user));
        setQuedan(dias);
        setObligatorio(!vista() && dias === 0);
        setFase('portada');
    };
    const despues = () => { if (quedan) aplazar(user); setFase(null); };

    useEffect(() => {
        if (!user) return;
        const forzada = new URLSearchParams(window.location.search).get('novedades') === '1';
        if (forzada) { abrir(); return; }
        if (vista()) return;
        const a = leerAplazo(user);
        if (Date.now() >= a.hasta || diasQueQuedan(a) === 0) abrir();
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        window.addEventListener(EVENTO, abrir);
        return () => window.removeEventListener(EVENTO, abrir);
    }); // eslint-disable-line react-hooks/exhaustive-deps

    if (!fase) return null;
    if (fase === 'portada') {
        return (
            <Portada obligatorio={obligatorio} quedan={quedan} onEmpezar={() => setFase('recorrido')} onDespues={despues} />
        );
    }
    return (
        <Recorrido pasos={PASOS} ctx={ctx} obligatorio={obligatorio} onCerrar={despues}
            onCompletar={() => { localStorage.setItem(clave(user), VISTA); setFase(null); }} />
    );
};

export default Novedades;
