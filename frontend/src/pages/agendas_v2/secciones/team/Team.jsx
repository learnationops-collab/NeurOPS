// Team: personas (People), prioridades (Priorities) y la semana (Available), con los turnos libres de
// cada closer según las sesiones de los eventos elegidos.

import { closers, horasSemana } from '../../core/datos';
import { almacen, useDatos, useUi } from '../../data/hooks';
import { Seg, Sx } from '../../ui/base';
import EnTope from '../../ui/EnTope';
import Available from './Available';
import Grupos from './Grupos';
import { ModalHorario } from './Horario';
import Personas from './Personas';
import { setTeam } from './comun';
import { gruposDeSesion } from './turnos';

const TABS = [
    { v: 'personas', n: 'People', icono: 'users' },
    { v: 'grupos', n: 'Estrategias', icono: 'rayo' },
    { v: 'available', n: 'Available', icono: 'calendar' },
];

// Available: la semana de cada closer con sus turnos libres. Los turnos dependen de cuánto dura cada
// sesión, así que se eligen los eventos (agrupados los que dan las mismas sesiones).
function Semana() {
    const { d } = useDatos();
    const { team } = useUi();
    const cs = closers(d).filter(p => horasSemana(p) > 0);
    const grupos = gruposDeSesion(d, cs);
    const g = grupos.find(x => x.eventos.some(e => e.id === team.evento)) || grupos[0];
    return (
        <>
            {g && (
                <div className="tu-barra">
                    <span className="t-rotulo">Turnos de</span>
                    <Sx sm id="tu-evento" label="Turnos de" valor={g.id} onChange={v => setTeam({ evento: v })}
                        opciones={grupos.map(x => ({ v: x.id, n: x.nombre + ' — ' + x.detalle, icono: 'calendar' }))} />
                </div>
            )}
            <Available evento={g ? g.evento : null} />
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
