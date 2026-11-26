// La conversación abierta (ADR-W184): el chat al centro y, a la derecha, la tarjeta del lead y su ficha. Arriba del
// chat no va nada: quién es, su número, la espera, la ventana y el bot están en la tarjeta (ADR-W238). En el chat,
// los mensajes con las notas, tareas y eventos intercalados; seleccionar parte de un mensaje del lead lo anota para la venta. Abajo, la caja; al pasar a una etapa con varios mensajes, se elige cuál pegar.
// Abrirla la marca como leída.
import { useCallback, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { EmptyState, Panel, toast } from '../../../components/standard';
import { abrirLearnito } from '../../../sesion/learnito';
import { inboxApi } from '../api';
import { recordado, recordar } from '../recuerdo';
import GloboCita, { seleccionDelLead } from './Cita';
import Composer from './Composer';
import Feed from './Feed';
import FichaLead from './FichaLead';
import MisStats from './MisStats';
import TarjetaLead from './TarjetaLead';
import useEnvio from './useEnvio';
import ReaccionRespuesta, { reaccionDe } from './ReaccionRespuesta';
import { REFRESCO, resuelta } from './colas';
import { completarGuia, pasosDe, siguienteId, useGuia, useLinkAgenda, visibles } from '../guia/useGuia';

function Chat({ datos, yo, pausar, onCambio, pegar, selector, onSelector }) {
    const { contacto, avance } = datos;
    const envio = useEnvio(contacto.id, onCambio);
    const [seleccion, setSeleccion] = useState(null);
    const cerrarSeleccion = useCallback(() => setSeleccion(null), []);
    // Meta a veces devuelve error y el mensaje sale igual: cuando aparece en el chat, el «no salió» sobra.
    const salio = (p) => p.estado === 'error' && datos.mensajes.some((m) => m.direccion === 'saliente'
        && m.texto === p.rotulo?.trim() && new Date(m.en) >= new Date(p.en) - 60000);
    const pendientes = envio.pendientes.filter((p) => !salio(p));
    // Al responder a un lead que esperaba: felicitación si fue en menos de 5 min, «guarda» si pasó de 30 (`ReaccionRespuesta`).
    const [reaccion, setReaccion] = useState(null);
    const cerrarReaccion = useCallback(() => setReaccion(null), []);
    const espera = () => {
        const u = datos.mensajes[datos.mensajes.length - 1];
        if (u?.direccion !== 'entrante' || resuelta({ ultimo_de: 'lead', ultimo_en: u.en, resuelta_en: contacto.resuelta_en })) return null;
        return (Date.now() - new Date(u.en)) / 1000;
    };
    const conReaccion = (fn) => async (...args) => {
        const seg = espera();
        const ok = await fn(...args);
        if (ok) setReaccion(reaccionDe(seg));
        return ok;
    };
    return (
        <Panel as="section" size="sm" className="cv-detalle" aria-label="Conversación">
            <Feed mensajes={datos.mensajes} notas={datos.notas || []} tareas={datos.tareas || []}
                pendientes={pendientes} onReintentar={envio.reintentar} onDescartar={envio.descartar}
                onSeleccion={() => setSeleccion(seleccionDelLead())} />
            <Composer contacto={contacto} pausar={pausar} fase={avance?.fase} ejecucion={datos.ejecucion} seguimientos={datos.seguimientos} yo={yo} onCambio={onCambio}
                onEnviar={conReaccion(envio.enviar)} onEnviarVarios={conReaccion(envio.enviarVarios)} onLearnito={abrirLearnito} pegar={pegar} selector={selector} onSelector={onSelector} />
            <ReaccionRespuesta reaccion={reaccion} onCerrar={cerrarReaccion} />
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
    // «Pausar el bot al responder»: el interruptor está en la tarjeta del lead y lo usa la caja al enviar.
    const [pausar, setPausar] = useState(true);
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
            return false;
        }
        // La Guía (ADR-W197): con un solo mensaje se pega directo; con más, se elige.
        const pasos = visibles(pasosDe(guia, fase));
        if (pasos.length === 1 && pasos[0].op.length === 1) {
            setSelector(null);
            setPegar({ texto: completarGuia(pasos[0].op[0].x, datos?.contacto, link), clave: `${fase}:${pasos[0].id}:0`,
                pasaA: pasos[0].avanza ? siguienteId(fase) : null, n: Date.now() });
        } else setSelector(pasos.length ? fase : null);
        return true;
    };

    if (error && !datos) return <Panel size="sm" className="cv-detalle"><EmptyState icon={<MessageSquare size={22} />}>{error}</EmptyState></Panel>;
    if (!datos) return <Panel size="sm" className="cv-detalle"><EmptyState>Cargando…</EmptyState></Panel>;
    const fase = datos.avance?.fase;
    return (
        <>
            <Chat datos={datos} yo={yo} pausar={pausar} onCambio={cambio} pegar={pegar} selector={selector}
                onSelector={(elegido) => { setSelector(null); if (elegido) setPegar({ ...elegido, n: Date.now() }); }} />
            <div className="cv-derecha">
                <TarjetaLead datos={datos} fase={fase} canal={datos.canal} yo={yo} pausar={pausar} onPausar={setPausar} onCambio={cambio} onMover={mover} />
                <MisStats />
                <FichaLead contacto={datos.contacto} tareas={datos.tareas || []} recorrido={datos.recorrido || []}
                    fases={datos.fases || []} citas={datos.citas || []} onCambio={cambio} />
            </div>
        </>
    );
}
