// Hours: la vista propia del closer. Su semana (agendadas, libres y huecos del equipo) y su horario.

import { colorVar, horasSemana } from '../../core/datos';
import { fmt } from '../../core/util';
import { usePermisos, useUi } from '../../data/hooks';
import { Avatar, Seg } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { Card, EmptyState, HeaderActions } from '../../../../components/standard';
import Available from './Available';
import { HorarioEditor } from './Horario';
import { HUMO_PERSONA } from './comun';

const TABS = [{ v: 'available', n: 'Available', icono: 'calendar' }, { v: 'schedule', n: 'Schedule', icono: 'clock' }];

export default function Horas() {
    const { yo } = usePermisos();
    const { horasTab } = useUi();
    if (!yo) return <EmptyState>Sin persona vinculada.</EmptyState>;
    const tab = horasTab === 'schedule' ? 'schedule' : 'available', hs = horasSemana(yo);
    return (
        <>
            <HeaderActions>
                <div className="barra">
                    <Seg nav label="Hours" valor={tab} opciones={TABS} onChange={v => ui.set({ horasTab: v })} />
                    <div className="barra-der hrs-yo">
                        <Avatar p={yo} clase="avatar--sm" />
                        <b>{yo.nombre}</b>
                        <span className="num">{hs ? fmt(hs, 1) + ' h/sem' : 'Sin horario'}</span>
                    </div>
                </div>
            </HeaderActions>
            {tab === 'available'
                ? <Available solo={yo} />
                : (
                    <Card as="section" className="persona hrs-disp" style={{ '--c': colorVar(yo.color) }} aura={HUMO_PERSONA} soft>
                        <HorarioEditor p={yo} />
                    </Card>
                )}
        </>
    );
}
