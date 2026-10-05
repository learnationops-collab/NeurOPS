// Configuración › Integraciones: solo la configuración (interruptores e IDs). La conexión real la hace el backend.

import { Icono, Switch } from '../../ui/base';
import { almacen, useDatos } from '../../data/hooks';
import { InputVivo, useDiferido } from './campos';

const soloNumeros = (t) => t.replace(/[^0-9]/g, '').slice(0, 20);

export default function TabIntegraciones() {
    const { integ: g } = useDatos();
    const set = (k, c, v) => almacen.guardarInteg({ ...g, [k]: { ...g[k], [c]: v } });
    // Los IDs se guardan con una pausa; se toma el estado más reciente al guardar.
    const guardarId = useDiferido(([k, c, v]) => { const a = almacen.getState().integ; almacen.guardarInteg({ ...a, [k]: { ...a[k], [c]: v } }); });

    const sw = (k, c, label) => (
        <div className="int-fila"><span>{label}</span><Switch on={g[k][c]} label={label} onChange={v => set(k, c, v)} /></div>
    );
    const campoId = (k, c, id, ph) => (
        <InputVivo className="input" id={id} inputMode="numeric" maxLength={20} placeholder={ph} aria-label={ph} valor={g[k][c]}
            filtro={soloNumeros} onCambio={v => guardarId([k, c, v])} />
    );
    const card = (k, icono, nombre, cuerpo) => {
        const on = g[k].activo;
        return (
            <section className={'int' + (on ? ' int--on' : '')}>
                <div className="int-cab">
                    <span className="icono-m"><Icono n={icono} s={19} /></span>
                    <b>{nombre}</b>
                    <Switch on={on} label={'Activar ' + nombre} onChange={v => set(k, 'activo', v)} />
                </div>
                {on && cuerpo}
            </section>
        );
    };
    return (
        <div className="integ">
            {card('gcal', 'calendar', 'Google Calendar', <>{sw('gcal', 'crear', 'Crear el evento en el calendario del closer')}{sw('gcal', 'ocupado', 'Bloquear horarios ocupados')}</>)}
            {card('meet', 'video', 'Google Meet', sw('meet', 'link', 'Link de Meet en cada llamada'))}
            {card('pixel', 'ojo', 'Pixel de Facebook', <>
                {campoId('pixel', 'id', 'int-pixel', 'ID del pixel')}
                {sw('pixel', 'lead', 'Lead al completar el formulario')}
                {sw('pixel', 'schedule', 'Schedule al agendar')}
                {sw('pixel', 'nocalifica', 'Contar también a los que no califican')}
            </>)}
            {card('meta', 'chart', 'Meta Ads', <>
                {campoId('meta', 'dataset', 'int-meta', 'ID del conjunto de datos')}
                {sw('meta', 'capi', 'Enviar conversiones desde el servidor')}
            </>)}
        </div>
    );
}
