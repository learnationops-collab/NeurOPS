// La conversación abierta (ADR-W184): el chat al centro y, a la derecha, la tarjeta del lead y su ficha. Arriba del
// chat, una sola línea: quién es, los tres puntos, la etapa del setting, cuánto espera y cuánto queda para poder
// responderle. En el chat, los mensajes con las notas, tareas y eventos intercalados; seleccionar parte de un mensaje
// del lead lo anota para la venta. Abajo, la caja; al pasar a una etapa con varios mensajes, se elige cuál pegar.
// Abrirla la marca como leída.
import { useCallback, useEffect, useState } from 'react';
import { Clock, Hourglass, MessageSquare } from 'lucide-react';
import { Chip, EmptyState, Panel, toast } from '../../../components/standard';
import { abrirLearnito } from '../../../sesion/learnito';
import { inboxApi } from '../api';
import { recordado, recordar } from '../recuerdo';
import GloboCita, { seleccionDelLead } from './Cita';
import Composer from './Composer';
import Feed from './Feed';
import FichaLead from './FichaLead';
import TarjetaLead from './TarjetaLead';
import useEnvio from './useEnvio';
import { ChipFase } from './Fila';
import { Puntos } from './Progreso';
import { REFRESCO, avisoCierre, cierreMin, colorEspera, esperaMin, esWhatsapp, quien, textoEspera } from './colas';
import IconoCanal from './IconoCanal';
import { completarGuia, pasosDe, siguienteId, useGuia, useLinkAgenda, visibles } from '../guia/useGuia';

function Linea({ contacto, avance, mensajes }) {
    const ahora = new Date();
    const ultimo = mensajes[mensajes.length - 1];
    const espera = ultimo?.direccion === 'entrante' ? esperaMin({ ultimo_de: 'lead', ultimo_en: ultimo.en }, ahora) : null;
    const queda = cierreMin(contacto, ahora);
    return (
        <div className="cv-chat-linea-sup">
            <IconoCanal c={contacto} size={14} />
            <b>{quien(contacto)}</b>
            <Puntos etapas={avance?.etapas} />
            <ChipFase fase={avance?.fase} />
            <span className="cv-chat-tiempos">
                {espera != null && <Chip subtle color={colorEspera(espera)} icon={<Clock />} data-tip="Desde su último mensaje">espera {textoEspera(espera)}</Chip>}
                {queda != null
                    ? <Chip subtle color={queda <= avisoCierre(contacto) ? 'var(--error)' : 'var(--success)'} icon={<Hourglass />}
                        data-tip={esWhatsapp(contacto)
                            ? 'Para responder|WhatsApp deja escribirle hasta 24 h después de su último mensaje'
                            : 'Para responder|Instagram deja escribirle hasta 7 días después de su último mensaje'}>quedan {textoEspera(queda)} para responder</Chip>
                    : <Chip subtle color="var(--error)" icon={<Hourglass />}>ventana cerrada</Chip>}
            </span>
        </div>
    );
}

function Chat({ datos, yo, onCambio, pegar, selector, onSelector }) {
    const { contacto, avance } = datos;
    const envio = useEnvio(contacto.id, onCambio);
    const [seleccion, setSeleccion] = useState(null);
    const cerrarSeleccion = useCallback(() => setSeleccion(null), []);
    return (
        <Panel as="section" size="sm" className="cv-detalle" aria-label="Conversación">
            <Linea contacto={contacto} avance={avance} mensajes={datos.mensajes} />
            <Feed mensajes={datos.mensajes} notas={datos.notas || []} tareas={datos.tareas || []}
                pendientes={envio.pendientes} onReintentar={envio.reintentar} onDescartar={envio.descartar}
                onSeleccion={() => setSeleccion(seleccionDelLead())} />
            <Composer contacto={contacto} fase={avance?.fase} ejecucion={datos.ejecucion} seguimientos={datos.seguimientos} yo={yo} onCambio={onCambio}
                onEnviar={envio.enviar} onLearnito={abrirLearnito} pegar={pegar} selector={selector} onSelector={onSelector} />
            {seleccion && <GloboCita contactoId={contacto.id} seleccion={seleccion} onCerrar={cerrarSeleccion} onHecho={() => { setSeleccion(null); onCambio(); }} />}
        </Panel>
    );
}

export default function Detalle({ id, yo, onLeido, onCambio }) {
    const [datos, setDatos] = useState(() => recordado(`chat:${id}`));
    const [error, setError] = useState(null);
    // Al pasar de etapa: la etapa cuyos mensajes se eligen (`selector`) y el texto que se pega en la caja (`pegar`).
    const [selector, setSelector] = useState(null);
    const [pegar, setPegar] = useState(null);
    const guia = useGuia();
    const link = useLinkAgenda();
    // Cada conversación monta un Detalle nuevo (key={id}): arranca con lo último que se vio de ese chat (recuerdo.js). Se vuelve a pedir cada
    // REFRESCO, y después de cada acción del setter, sin vaciar lo que se ve.
    const pedir = useCallback(() => inboxApi.conversacion(id)
        .then((d) => { recordar(`chat:${id}`, d); setDatos(d); setError(null); })
        .catch(() => setError('No se pudo cargar la conversación')), [id]);
    useEffect(() => {
        pedir();
        const cada = setInterval(pedir, REFRESCO);
        return () => clearInterval(cada);
    }, [pedir]);
    // Leída al abrirla y cada vez que entra un mensaje mientras está abierta.
    const cantidad = datos?.mensajes?.length;
    useEffect(() => {
        if (cantidad == null) return;
        inboxApi.leido(id).then(() => onLeido?.(id))
            .catch(() => { /* sin marca: se reintenta con el próximo mensaje */ });
    }, [id, cantidad, onLeido]);

    const cambio = useCallback(() => { pedir(); onCambio?.(); }, [pedir, onCambio]);
    // Mover de etapa: con varios mensajes se elige cuál pegar; con uno, se pega directo. Nada sale solo.
    const mover = async (fase) => {
        try {
            await inboxApi.moverFase(id, fase);
            cambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo mover de etapa', 'error');
            return;
        }
        // La Guía (ADR-W197): con un solo mensaje se pega directo; con más, se elige.
        const pasos = visibles(pasosDe(guia, fase));
        if (pasos.length === 1 && pasos[0].op.length === 1) {
            setSelector(null);
            setPegar({ texto: completarGuia(pasos[0].op[0].x, datos?.contacto, link), clave: `${fase}:${pasos[0].id}:0`,
                pasaA: pasos[0].avanza ? siguienteId(fase) : null, n: Date.now() });
        } else setSelector(pasos.length ? fase : null);
    };

    if (error && !datos) return <Panel size="sm" className="cv-detalle"><EmptyState icon={<MessageSquare size={22} />}>{error}</EmptyState></Panel>;
    if (!datos) return <Panel size="sm" className="cv-detalle"><EmptyState>Cargando…</EmptyState></Panel>;
    const fase = datos.avance?.fase;
    return (
        <>
            <Chat datos={datos} yo={yo} onCambio={cambio} pegar={pegar} selector={selector}
                onSelector={(elegido) => { setSelector(null); if (elegido) setPegar({ ...elegido, n: Date.now() }); }} />
            <div className="cv-derecha">
                <TarjetaLead datos={datos} fase={fase} canal={datos.canal} yo={yo} onCambio={cambio} onMover={mover} />
                <FichaLead contacto={datos.contacto} tareas={datos.tareas || []} recorrido={datos.recorrido || []}
                    fases={datos.fases || []} citas={datos.citas || []} onCambio={cambio} />
            </div>
        </>
    );
}
