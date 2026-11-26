// Lo que pide atención ahora, en la tarjeta del lead (ADR-W238; antes iba arriba del chat): cuánto espera, el anillo
// de lo que queda para responderle y «No requiere respuesta»; y el bot: en qué flujo está y el interruptor de
// pausarlo al responder (el bot deja de hablarle 24 h y se corta el flujo abierto).
import { useState } from 'react';
import { Bot, CheckCheck, Copy, Undo2 } from 'lucide-react';
import { Switch, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import MenuBot, { EJECUCION } from './AccionesFlujo';
import { avisoCierre, cierreMin, esperaMin, esWhatsapp, resuelta } from './colas';
import { Ventana } from './Indicadores';
import Cronometro from './Cronometro';

// El número del lead de WhatsApp: tocarlo lo copia.
export function Telefono({ contacto }) {
    if (!esWhatsapp(contacto)) return null;
    const numero = `+${contacto.igsid.slice(3)}`;
    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(numero);
            toast('Número copiado');
        } catch {
            toast('No se pudo copiar', 'error');
        }
    };
    return <button type="button" className="cv-tel" onClick={copiar} data-tip="Copiar número">{numero}<Copy size={11} aria-hidden="true" /></button>;
}

// «No requiere respuesta» (ADR-W235): saca el chat de «Esperan respuesta» hasta que el lead vuelva a escribir.
function Resolver({ contacto, marcada, onCambio, compacto }) {
    const [enviando, setEnviando] = useState(false);
    const cambiar = async () => {
        setEnviando(true);
        try {
            await inboxApi.resuelta(contacto.id, !marcada);
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo marcar', 'error');
        } finally {
            setEnviando(false);
        }
    };
    return (
        <button type="button" className={`cv-resolver${marcada ? ' cv-resolver--on' : ''}${compacto ? ' cv-resolver--ico' : ''}`} disabled={enviando} onClick={cambiar}
            aria-label={marcada ? 'Resuelta: volver a «Esperan respuesta»' : 'No requiere respuesta'}
            data-tip={marcada ? 'Marcada: no requiere respuesta|Tocala para que vuelva a «Esperan respuesta»' : 'No requiere respuesta|Sale de «Esperan respuesta» hasta que vuelva a escribir'}>
            {marcada ? <Undo2 size={12} aria-hidden="true" /> : <CheckCheck size={12} aria-hidden="true" />}
            {!compacto && (marcada ? 'Resuelta' : 'No requiere')}
        </button>
    );
}

// Lo que vale «No requiere» en este chat: si lo último es del lead y si ya está marcada.
function estadoDe(contacto, mensajes) {
    const ultimo = mensajes[mensajes.length - 1];
    const delLead = ultimo?.direccion === 'entrante' ? { ultimo_de: 'lead', ultimo_en: ultimo.en } : null;
    return { delLead, marcada: Boolean(delLead && resuelta({ ...delLead, resuelta_en: contacto.resuelta_en })) };
}

// `compacto` (ADR-W250): en la fila de arriba de la tarjeta, al lado de la palabra clave. «No requiere» ya no va acá:
// va al lado del interruptor del bot (`ResolverLead`, Mario 26/11/2026).
export function Ahora({ contacto, mensajes, compacto }) {
    const ahora = new Date();
    const { delLead, marcada } = estadoDe(contacto, mensajes);
    const espera = delLead && !marcada ? esperaMin(delLead, ahora) : null;
    return (
        <div className="cv-ahora">
            {espera != null && <Cronometro desde={delLead.ultimo_en} grande={!compacto} />}
            <Ventana contacto={contacto} queda={cierreMin(contacto, ahora)} aviso={avisoCierre(contacto)} mini={compacto} />
        </div>
    );
}

// «No requiere» con su rótulo abajo, igual que el interruptor «Pausar» del bot. Sin mensaje del lead pendiente, no ocupa nada.
export function ResolverLead({ contacto, mensajes, onCambio }) {
    const { delLead, marcada } = estadoDe(contacto, mensajes);
    if (!delLead) return null;
    return (
        <span className="cv-bot-switch cv-bot-resolver">
            <Resolver contacto={contacto} marcada={marcada} onCambio={onCambio} compacto />
            <small>{marcada ? 'Listo' : 'No req.'}</small>
        </span>
    );
}

// El bot: su flujo (tocarlo abre el menú de siempre) y el interruptor «Pausar al responder», a la vista.
export function BotLead({ contacto, ejecucion, pausar, onPausar, onCambio, children }) {
    const pausado = contacto.bot_pausado_hasta && new Date(contacto.bot_pausado_hasta) > new Date();
    const estado = ejecucion ? (EJECUCION[ejecucion.estado]?.texto || ejecucion.estado).toLowerCase() : null;
    const hasta = pausado ? new Date(contacto.bot_pausado_hasta).toLocaleString('es', { hour: '2-digit', minute: '2-digit' }) : null;
    return (
        <div className={`cv-bot${pausar ? ' cv-bot--pausa' : ''}`}>
            <MenuBot contacto={contacto} ejecucion={ejecucion} onCambio={onCambio} className="cv-bot-flujo">
                <span className="cv-bot-ico"><Bot size={14} aria-hidden="true" /></span>
                <span className="cv-bot-t">
                    <b>{ejecucion ? ejecucion.flujo : 'Sin flujo'}</b>
                    <small>{pausado ? `En pausa hasta las ${hasta}` : estado || 'El bot no arrancó'}</small>
                </span>
            </MenuBot>
            <span className="cv-bot-switch" data-tip="Pausar el bot al responder|El bot deja de hablarle 24 h y se corta el flujo abierto">
                <Switch checked={pausar} onChange={onPausar} label="Pausar el bot al responder" />
                <small>Pausar</small>
            </span>
            {children}
        </div>
    );
}
