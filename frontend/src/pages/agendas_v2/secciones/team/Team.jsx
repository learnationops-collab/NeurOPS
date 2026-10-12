// Team: personas (People), prioridades (Priorities) y la semana (Available): los turnos que le quedan a
// cada closer en un evento o, en Calendario, la cobertura por franjas.

import { closers, horasSemana, ord } from '../../core/datos';
import { almacen, useDatos, useUi } from '../../data/hooks';
import { Seg, Sx } from '../../ui/base';
import EnTope from '../../ui/EnTope';
import Available from './Available';
import Grupos from './Grupos';
import { ModalHorario } from './Horario';
import Personas from './Personas';
import TablaTurnos from './Turnos';
import { setTeam } from './comun';

const TABS = [
    { v: 'personas', n: 'People', icono: 'users' },
    { v: 'grupos', n: 'Estrategias', icono: 'rayo' },
    { v: 'available', n: 'Available', icono: 'calendar' },
];

// Available: por defecto los turnos de un evento (cada closer tiene su sesión en cada uno); Calendario,
// las franjas de la semana.
function Semana() {
    const { d } = useDatos();
    const { team } = useUi();
    const vista = team.vista === 'calendario' ? 'calendario' : 'turnos';
    const evs = ord(d, 'eventos').filter(e => !e.persona).sort((a, b) => (b.activo ? 1 : 0) - (a.activo ? 1 : 0));
    const ev = evs.find(e => e.id === team.evento) || evs[0];
    const cs = closers(d).filter(p => horasSemana(p) > 0);
    return (
        <>
            <div className="tu-barra">
                <Seg sm label="Vista" valor={vista} onChange={v => setTeam({ vista: v })}
                    opciones={[{ v: 'turnos', n: 'Turnos', icono: 'users' }, { v: 'calendario', n: 'Calendario', icono: 'calendar' }]} />
                {vista === 'turnos' && ev && (
                    <Sx sm id="tu-evento" label="Evento" valor={ev.id} onChange={v => setTeam({ evento: v })}
                        opciones={evs.map(e => ({ v: e.id, n: e.nombre + (e.activo ? '' : ' (pausado)'), icono: 'calendar' }))} />
                )}
            </div>
            {vista === 'calendario' ? <Available /> : ev ? (
                <section className="panel caja"><TablaTurnos evento={ev} personas={cs} /></section>
            ) : <div className="panel vacio"><p className="t-sm mut">Creá un evento para ver cuántos turnos le quedan a cada closer.</p></div>}
        </>
    );
}

export default function Team() {
    const { team } = useUi();
    const tab = TABS.some(t => t.v === team.tab) ? team.tab : 'personas';
    return (
        <>
            <EnTope>
                <div className="barra">
                    <Seg nav label="Team" valor={tab} opciones={TABS} onChange={v => { almacen.flush(); setTeam({ tab: v }); }} />
                </div>
            </EnTope>
            {tab === 'personas' ? <Personas /> : tab === 'available' ? <Semana /> : <Grupos />}
            <ModalHorario />
        </>
    );
}
