// Las acciones del bot, desplegables desde la etapa automática (arriba del chat): continuar desde un
// paso, reiniciar, cambiar de flujo (raro) y pausar o reanudar. Sin recorrido, iniciar un flujo.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Pause, Play, RotateCcw } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { toast } from '../../../components/standard';
import { inboxApi } from '../api';
import ModalFlujo from './ModalFlujo';

export const EJECUCION = {
    en_curso: { texto: 'En curso', color: 'var(--info)' },
    esperando_respuesta: { texto: 'Esperando respuesta', color: 'var(--info)' },
    esperando_tiempo: { texto: 'Esperando', color: 'var(--info)' },
    pendiente: { texto: 'Pendiente: arranca cuando el lead escriba', color: 'var(--warning)' },
    terminada: { texto: 'Terminó', color: 'var(--success)' },
    cancelada: { texto: 'Pausado', color: 'var(--warning)' },
    ventana_vencida: { texto: 'Venció la ventana de 24 h', color: 'var(--warning)' },
    error: { texto: 'Error', color: 'var(--error)' },
};

export default function MenuBot({ contacto, ejecucion, onCambio, children, className, style }) {
    const [abierto, setAbierto] = useState(false);
    const [accion, setAccion] = useState(null);
    const [pausando, setPausando] = useState(false);
    const caja = useRef(null);
    const pop = useEnPantalla();
    const pausado = contacto.bot_pausado_hasta && new Date(contacto.bot_pausado_hasta) > new Date();
    const cortada = ejecucion && ['error', 'ventana_vencida'].includes(ejecucion.estado);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
    }, [abierto]);

    const elegir = (a) => { setAbierto(false); setAccion(a); };
    const cambiarBot = async () => {
        setAbierto(false);
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

    const opciones = ejecucion ? [
        ['continuar', 'Continuar desde…', Play],
        ['reiniciar', 'Reiniciar el flujo', RotateCcw],
        ['cambiar', 'Cambiar de flujo', ArrowLeftRight],
    ] : [['iniciar', 'Iniciar un flujo', Play]];

    return (
        <div className="cv-menu-bot" ref={caja}>
            <button type="button" className={className} style={style} aria-haspopup="menu" aria-expanded={abierto}
                data-tip="Acciones del bot" onClick={() => setAbierto((a) => !a)}>{children}</button>
            {abierto && (
                <div className="cv-menu-pop" ref={pop} role="menu">
                    {opciones.map(([a, label, Icono]) => (
                        <button key={a} type="button" role="menuitem" onClick={() => elegir(a)}><Icono size={14} />{label}</button>
                    ))}
                    <button type="button" role="menuitem" disabled={pausando} onClick={cambiarBot}>
                        {pausado ? <Play size={14} /> : <Pause size={14} />}{pausado ? 'Reanudar el bot' : 'Pausar el bot'}
                    </button>
                </div>
            )}
            {accion && (
                <ModalFlujo accion={accion} contacto={contacto} ejecucion={ejecucion} cortada={cortada}
                    onCerrar={() => setAccion(null)} onHecho={() => { setAccion(null); onCambio(); }} />
            )}
        </div>
    );
}
