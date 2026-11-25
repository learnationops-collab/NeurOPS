import React, { useEffect, useState } from 'react';
import { ArrowRight, X, Sparkles, PanelRight, CalendarDays, UserSquare2, CheckCircle2, CalendarClock, Clock } from 'lucide-react';
import { VERSION, FECHA, PORTADA, PASOS } from './contenido';
import Recorrido from './Recorrido';
import { useCuenta } from './Mocks';
import './novedades.css';

// Las novedades del Workspace de closers y triage (ADR-W218). La primera vez que alguien entra
// después de una tanda nueva (VERSION) ve la portada a pantalla completa; «Mostrame» arranca el
// recorrido por los lugares reales de Work. «Después» la vuelve a mostrar en la próxima visita;
// empezar el recorrido la da por vista. Se vuelve a abrir desde Herramientas › Novedades
// (`abrirNovedades()`) o con `?novedades=1` en la dirección.

const EVENTO = 'ln:novedades';
const clave = (user) => `ln_novedades_${user?.id ?? 'anon'}`;
const POSPUESTA = 'ln_novedades_despues';

export const abrirNovedades = () => window.dispatchEvent(new Event(EVENTO));

const ICONOS = { riel: PanelRight, calendario: CalendarDays, tarjeta: UserSquare2, confirmacion: CheckCircle2, reprogramar: CalendarClock, horario: Clock };

const Portada = ({ onEmpezar, onDespues }) => {
    const n = useCuenta(PORTADA.length, 900, 700);
    useEffect(() => {
        const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onDespues(); } };
        window.addEventListener('keydown', tecla, true);
        return () => window.removeEventListener('keydown', tecla, true);
    }, [onDespues]);
    return (
        <div className="nv-portada" role="dialog" aria-modal="true" aria-label="Novedades de Work">
            <span className="nv-humo" aria-hidden="true"><i /><i /><i /><i /></span>
            <button type="button" className="nv-portada__x" onClick={onDespues} aria-label="Después"><X /></button>
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
                    <button type="button" className="nv-despues" onClick={onDespues}>Después</button>
                </div>
            </div>
        </div>
    );
};

const Novedades = ({ user, ctx }) => {
    const [fase, setFase] = useState(null);

    useEffect(() => {
        if (!user) return;
        const forzada = new URLSearchParams(window.location.search).get('novedades') === '1';
        const vista = localStorage.getItem(clave(user)) === VERSION;
        const pospuesta = sessionStorage.getItem(POSPUESTA) === VERSION;
        if (forzada || (!vista && !pospuesta)) setFase('portada');
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const abrir = () => setFase('portada');
        window.addEventListener(EVENTO, abrir);
        return () => window.removeEventListener(EVENTO, abrir);
    }, []);

    if (!fase) return null;
    if (fase === 'portada') {
        return (
            <Portada
                onEmpezar={() => { localStorage.setItem(clave(user), VERSION); setFase('recorrido'); }}
                onDespues={() => { sessionStorage.setItem(POSPUESTA, VERSION); setFase(null); }}
            />
        );
    }
    return <Recorrido pasos={PASOS} ctx={ctx} onCerrar={() => setFase(null)} />;
};

export default Novedades;
