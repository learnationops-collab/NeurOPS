// La herramienta «Turnos» (ventanas/herramientas.js): los turnos que quedan de triage y de closers por día
// (TurnosEquipo, Leadership 1397), en una ventana encima de cualquier pantalla, sin ir a Tálamus. Lee lo
// mismo que Team › Available: el almacén de Tálamus (en solo lectura para el setter), las agendas y el
// Google de cada uno. La semana es la de Tálamus (team.semana), así «Por persona» y Available coinciden.

import { useMemo, useState } from 'react';
import '../../pages/agendas_v2/thalamus.css';
import { dataThemeDe, useApariencia } from '../../context/AparienciaContext';
import { esCloser, esTriage, horasSemana, ord } from '../../pages/agendas_v2/core/datos';
import { fechaCorta } from '../../pages/agendas_v2/core/tiempo';
import { useDatos, useIniciarAlmacen, useUi } from '../../pages/agendas_v2/data/hooks';
import { Icono, Tooltip } from '../../pages/agendas_v2/ui/base';
import { rangoSemana } from '../../pages/agendas_v2/secciones/team/cobertura';
import { setTeam } from '../../pages/agendas_v2/secciones/team/comun';
import { agendasDeVista, useAhora, useOcupacionGoogle, useZonaVista } from '../../pages/agendas_v2/secciones/team/semana';
import TurnosEquipo, { ofrecidas } from '../../pages/agendas_v2/secciones/team/TurnosEquipo.jsx';
import { ZONAS } from '../../pages/agendas_v2/core/catalogos';
import { Button, IconButton, Input } from '../../components/standard';

const DIA_MS = 86400000;
const CLAVE_TZ = 'turnos-zona';
const leerZona = () => { try { return window.localStorage.getItem(CLAVE_TZ); } catch { return null; } };

export default function TurnosVentana() {
    useIniciarAlmacen();
    const { cargando, d, reservas, elegibles } = useDatos();
    const { team, tema } = useUi();
    const apariencia = useApariencia();
    const semana = team.semana || 0;
    const ahora = useAhora();
    const zonaPropia = useZonaVista();
    // La hora en que se leen los turnos: la elegida (se recuerda en este navegador) o la propia.
    const [zonaElegida, setZonaElegida] = useState(leerZona);
    const tz = zonaElegida || zonaPropia;
    const elegirZona = (z) => {
        setZonaElegida(z || null);
        try { if (z) window.localStorage.setItem(CLAVE_TZ, z); else window.localStorage.removeItem(CLAVE_TZ); } catch { /* sin almacenamiento */ }
    };
    const personas = useMemo(() => (d ? ofrecidas(ord(d, 'personas'), elegibles).filter(p => (esCloser(d, p) || esTriage(d, p)) && horasSemana(p) > 0) : []), [d, elegibles]);
    const { desde, hasta, lunes } = rangoSemana(personas, semana, ahora, tz);
    const google = useOcupacionGoogle(desde, hasta, !cargando && personas.length > 0);
    const vista = useMemo(() => agendasDeVista(reservas, google), [reservas, google]);
    const ir = (v) => setTeam({ semana: v === 0 ? 0 : semana + v });
    const claveDe = (ms) => new Date(ms).toISOString().slice(0, 10);
    const tematica = dataThemeDe(apariencia, tema === 'claro' ? 'light' : tema === 'oscuro' ? 'dark' : undefined);

    return (
        <div className="thalamus vt-thalamus" data-theme={tematica}>
            <div className="av-nav vt-nav">
                <IconButton label="Semana anterior" icon={<Icono n="chevron-left" />} size="sm" data-nav="" onClick={() => ir(-1)} />
                <Button data-nav="" disabled={!semana} onClick={() => ir(0)}>Esta semana</Button>
                <IconButton label="Semana siguiente" icon={<Icono n="chevron-right" />} size="sm" data-nav="" onClick={() => ir(1)} />
                {lunes != null && <b className="av-rango" aria-live="polite">{fechaCorta(claveDe(lunes)) + ' – ' + fechaCorta(claveDe(lunes + 6 * DIA_MS))}</b>}
                <label className="vt-zona">
                    <span className="t-sm mut">Ver en hora de</span>
                    <Input as="select" data-nav="" value={zonaElegida || ''} onChange={(e) => elegirZona(e.target.value)} aria-label="Zona horaria">
                        <option value="">La mía ({zonaPropia || 'del navegador'})</option>
                        {ZONAS.map(z => <option key={z.tz + z.n} value={z.tz}>{z.n}</option>)}
                    </Input>
                </label>
            </div>
            {cargando
                ? <p className="t-sm mut">Leyendo los horarios del equipo…</p>
                : <TurnosEquipo vista={vista} google={google} semana={semana} ahora={ahora} tz={tz} />}
            <Tooltip />
        </div>
    );
}
