// La barra del flujo en el chat: en qué estado está la persona y qué puede hacer el setter. Continuar
// se destaca cuando el recorrido se cortó; cambiar de flujo es raro y va como ícono.
import { useState } from 'react';
import { ArrowLeftRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Button, IconButton, toast } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { inboxApi } from '../api';
import ModalFlujo from './ModalFlujo';

export const EJECUCION = {
    en_curso: { texto: 'En curso', color: 'var(--info)' },
    esperando_respuesta: { texto: 'Esperando respuesta', color: 'var(--info)' },
    esperando_tiempo: { texto: 'Esperando', color: 'var(--info)' },
    pendiente: { texto: 'Pendiente: arranca cuando el lead escriba', color: 'var(--warning)' },
    terminada: { texto: 'Terminó', color: 'var(--success)' },
    cancelada: { texto: 'Cancelado', color: 'var(--idle)' },
    ventana_vencida: { texto: 'Venció la ventana de 24 h', color: 'var(--warning)' },
    error: { texto: 'Error', color: 'var(--error)' },
};
const RETOMABLE = ['error', 'ventana_vencida', 'cancelada'];

export default function AccionesFlujo({ contacto, ejecucion, onCambio }) {
    const [accion, setAccion] = useState(null);
    const [pausando, setPausando] = useState(false);
    const pausado = contacto.bot_pausado_hasta && new Date(contacto.bot_pausado_hasta) > new Date();
    const est = ejecucion && (EJECUCION[ejecucion.estado] || { texto: ejecucion.estado, color: 'var(--idle)' });
    const cortada = ejecucion && ['error', 'ventana_vencida'].includes(ejecucion.estado);

    const cambiarBot = async () => {
        setPausando(true);
        try {
            await inboxApi.bot(contacto.id, !pausado);
            toast(pausado ? 'Bot reanudado' : 'Bot en pausa por 24 h para esta persona');
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cambiar el bot', 'error');
        } finally {
            setPausando(false);
        }
    };

    return (
        <div className="cv-acciones">
            <span className="cv-acciones-estado">
                <i className="fl-punto" style={{ '--c': est?.color || 'var(--warning)' }} />
                <span>{ejecucion
                    ? <><b>{ejecucion.flujo}</b> · {est.texto}{ejecucion.paso ? ` · ${rotuloPaso(ejecucion.paso)}` : ''}</>
                    : 'Ningún flujo arrancó'}</span>
            </span>
            {ejecucion ? (
                <>
                    <Button variant={RETOMABLE.includes(ejecucion.estado) ? 'primary' : 'secondary'} icon={<Play />} onClick={() => setAccion('continuar')}>Continuar desde…</Button>
                    <Button icon={<RotateCcw />} onClick={() => setAccion('reiniciar')}>Reiniciar</Button>
                    <IconButton size="sm" label="Cambiar de flujo" data-tip="Cambiar de flujo" icon={<ArrowLeftRight size={14} />} onClick={() => setAccion('cambiar')} />
                </>
            ) : <Button variant="primary" icon={<Play />} onClick={() => setAccion('iniciar')}>Iniciar flujo</Button>}
            <span className="cv-acciones-sep" />
            <Button icon={pausado ? <Play /> : <Pause />} disabled={pausando} onClick={cambiarBot}>{pausado ? 'Reanudar bot' : 'Pausar bot'}</Button>
            {accion && (
                <ModalFlujo accion={accion} contacto={contacto} ejecucion={ejecucion} cortada={cortada}
                    onCerrar={() => setAccion(null)} onHecho={() => { setAccion(null); onCambio(); }} />
            )}
        </div>
    );
}
