// Hours: la vista propia del closer. Su semana (agendadas, libres y huecos del equipo) y su horario.

import { colorVar, horasSemana } from '../../core/datos';
import { fmt } from '../../core/util';
import { usePermisos, useUi } from '../../data/hooks';
import { Avatar, Humo, Seg } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import Available from './Available';
import { HorarioEditor } from './Horario';
import { HUMO_PERSONA } from './comun';

const TABS = [{ v: 'available', n: 'Available', icono: 'calendar' }, { v: 'schedule', n: 'Schedule', icono: 'clock' }];

export default function Horas() {
    const { yo } = usePermisos();
    const { horasTab } = useUi();
    if (!yo) return <div className="panel vacio"><p className="t-sm mut">Sin persona vinculada.</p></div>;
    const tab = horasTab === 'schedule' ? 'schedule' : 'available', hs = horasSemana(yo);
    return (
        <>
            <div className="barra">
                <Seg nav label="Hours" valor={tab} opciones={TABS} onChange={v => ui.set({ horasTab: v })} />
                <div className="barra-der hrs-yo">
                    <Avatar p={yo} clase="avatar--sm" />
                    <b>{yo.nombre}</b>
                    <span className="num">{hs ? fmt(hs, 1) + ' h/sem' : 'Sin horario'}</span>
                </div>
            </div>
            {tab === 'available'
                ? <Available solo={yo} />
                : (
                    <section className="tarjeta persona caja hrs-disp" style={{ '--c': colorVar(yo.color) }}>
                        <Humo clase="humo--tarjeta humo--suave" cols={HUMO_PERSONA} />
                        <HorarioEditor p={yo} />
                    </section>
                )}
        </>
    );
}
