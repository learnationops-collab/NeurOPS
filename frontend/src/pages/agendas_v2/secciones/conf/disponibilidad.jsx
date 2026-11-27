// Configuración › Disponibilidad y Configuración › Sesiones, cada una en su pestaña.
// Disponibilidad: el horario de la persona de Team de la cuenta (el mismo editor de Team), con la zona, el
// tope por semana y los cupos libres de los próximos días arriba (se recalculan mientras se edita).
// Sesiones: cuánto dura cada sesión y el margen que se deja después, por evento.

import { useEffect, useState } from 'react';
import api from '../../../../services/api';
import { HorarioEditor } from '../team/Horario';
import { EditorSesiones } from '../team/Sesiones';
import { Mensajes } from './cuenta';
import Cupos from './Cupos';
import { Button, Panel } from '../../../../components/standard';

const EVENTO_HORARIO = 'neurops:horario';

export function TarjetaDisponibilidad() {
    const [datos, setDatos] = useState(null);
    const [p, setP] = useState(null); // { id, horario, tz, llamadas_semana }
    const [cambios, setCambios] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);

    const aplicar = (r) => {
        setDatos(r);
        setP({ id: 'yo', horario: r.horario || {}, tz: r.tz, llamadas_semana: r.llamadas_semana || 0 });
        setCambios(false);
    };
    useEffect(() => {
        api.get('/auth/me/disponibilidad').then((r) => aplicar(r.data)).catch(() => setError('No se pudo leer tu disponibilidad.'));
    }, []);
    const editar = (campos) => {
        // Sesiones muestra cuántas entran con este horario: se entera mientras se edita.
        if (campos.horario) window.dispatchEvent(new CustomEvent(EVENTO_HORARIO, { detail: campos.horario }));
        setP(x => ({ ...x, ...campos }));
        setCambios(true); setAviso(null);
    };
    const guardar = async () => {
        setOcupado(true); setError(null);
        try {
            const r = await api.put('/auth/me/disponibilidad', { horario: p.horario, tz: p.tz, llamadas_semana: p.llamadas_semana });
            aplicar(r.data);
            setAviso('Guardado');
        } catch (e) {
            setError(e?.response?.data?.message || 'No se pudo guardar. Probá de nuevo.');
        } finally { setOcupado(false); }
    };

    if (!datos) return <Panel as="section" className="cu-tarjeta disp-conf"><p className="t-sm mut">{error || 'Cargando…'}</p></Panel>;
    // Con su horario cargado en Leadership, se edita allá (ADR-W133): acá se ve como queda.
    if (datos.fuente === 'leadership') {
        return (
            <Panel as="section" className="cu-tarjeta disp-conf">
                <Cupos />
                <p className="t-sm mut">Tu horario se edita en Leadership (Setting · Disponibilidad).</p>
                <div className="horario--horizontal" style={{ pointerEvents: 'none', opacity: 0.75 }} aria-disabled="true">
                    <HorarioEditor p={p} onGuardar={() => {}} />
                </div>
            </Panel>
        );
    }
    return (
        <Panel as="section" className="cu-tarjeta disp-conf">
            <Cupos borrador={cambios ? { horario: p.horario, tz: p.tz } : null} />
            <div className="horario--horizontal">
                <HorarioEditor p={p} onGuardar={editar} acciones={(
                    <>
                        <Mensajes error={error} aviso={aviso} />
                        <Button variant="primary" disabled={ocupado || !cambios} onClick={guardar}>
                            {ocupado ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </>
                )} />
            </div>
        </Panel>
    );
}

/** Sesiones: la propuesta es la del evento; lo que se ajusta acá queda en su persona de Team, donde la
 * dirección comercial lo revisa. */
export function TarjetaSesiones() {
    const [datos, setDatos] = useState(null);
    const [sesiones, setSesiones] = useState({});
    const [horario, setHorario] = useState(null);
    const [cambios, setCambios] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);

    const aplicar = (r) => {
        setDatos(r);
        setHorario(r.horario || null);
        setSesiones(Object.fromEntries((r.eventos || []).filter(e => e.propia && Object.keys(e.propia).length).map(e => [e.id, e.propia])));
        setCambios(false);
    };
    useEffect(() => {
        api.get('/auth/me/sesiones').then((r) => aplicar(r.data)).catch(() => setError('No se pudieron leer tus sesiones.'));
        const alCambiarHorario = (e) => setHorario(e.detail);
        window.addEventListener(EVENTO_HORARIO, alCambiarHorario);
        return () => window.removeEventListener(EVENTO_HORARIO, alCambiarHorario);
    }, []);
    const guardar = async () => {
        setOcupado(true); setError(null);
        try {
            const r = await api.put('/auth/me/sesiones', { sesiones });
            aplicar(r.data);
            setAviso('Guardado');
        } catch (e) {
            setError(e?.response?.data?.message || 'No se pudo guardar. Probá de nuevo.');
        } finally { setOcupado(false); }
    };

    return (
        <Panel as="section" className="cu-tarjeta">
            {!datos ? <p className="t-sm mut">{error || 'Cargando…'}</p> : (
                <>
                    <EditorSesiones eventos={datos.eventos || []} sesiones={sesiones} horario={horario}
                        onCambio={(s) => { setSesiones(s); setCambios(true); setAviso(null); }} />
                    <div className="cu-fila cu-fila--fin">
                        <Mensajes error={error} aviso={aviso} />
                        <Button variant="primary" disabled={ocupado || !cambios} onClick={guardar}>
                            {ocupado ? 'Guardando…' : 'Guardar sesiones'}
                        </Button>
                    </div>
                </>
            )}
        </Panel>
    );
}
