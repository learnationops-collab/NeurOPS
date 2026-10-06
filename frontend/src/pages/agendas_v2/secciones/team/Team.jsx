// Team: personas (People), prioridades (Priorities) y cobertura semanal (Available).

import { almacen, useUi } from '../../data/hooks';
import { Seg } from '../../ui/base';
import EnTope from '../../ui/EnTope';
import Available from './Available';
import Grupos from './Grupos';
import { ModalHorario } from './Horario';
import Personas from './Personas';
import { setTeam } from './comun';

const TABS = [
    { v: 'personas', n: 'People', icono: 'users' },
    { v: 'grupos', n: 'Estrategias', icono: 'rayo' },
    { v: 'available', n: 'Available', icono: 'calendar' },
];

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
            {tab === 'personas' ? <Personas /> : tab === 'available' ? <Available /> : <Grupos />}
            <ModalHorario />
        </>
    );
}
