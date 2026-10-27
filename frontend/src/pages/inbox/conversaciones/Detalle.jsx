// La conversación abierta: el chat al centro y la ficha a la derecha. Arriba del chat, las tres etapas
// (la automática despliega las acciones del bot); en el chat, los mensajes con las notas, las tareas y
// los eventos intercalados; abajo, la caja de Chat, Nota interna y Tarea. Abrirla la marca como leída.
import { useCallback, useEffect, useState } from 'react';
import { Instagram, MessageSquare } from 'lucide-react';
import { Avatar, EmptyState, IconButton, Panel } from '../../../components/standard';
import { inboxApi } from '../api';
import Composer from './Composer';
import Etiquetas from './Etiquetas';
import FichaLead from './FichaLead';
import Feed from './Feed';
import { Asignado, Califica } from './Fila';
import { Tramos } from './Progreso';
import { REFRESCO, examenDe, quien } from './colas';

function Chat({ datos, yo, onCambio }) {
    const { contacto, asignado, avance } = datos;
    const examen = examenDe({ examen: contacto.variables?.examen });
    return (
        <Panel as="section" size="sm" className="cv-detalle" aria-label="Conversación">
            <div className="cv-chat-cab">
                <Avatar name={contacto.username || contacto.nombre || '?'} />
                <div className="cv-chat-quien">
                    <h3 className="t-h3">{quien(contacto)}</h3>
                    <span className="cv-chat-linea">
                        {examen && <span className="t-cap mut">{examen}</span>}
                        <Califica valor={contacto.variables?._califica} />
                    </span>
                    <Etiquetas contactoId={contacto.id} etiquetas={datos.etiquetas || []} onCambio={onCambio} />
                </div>
                <div className="cv-chat-asignado">
                    <Asignado asignado={asignado} yo={yo} />
                    <span className="t-cap mut40">{asignado?.a_mano ? 'asignada a mano' : asignado?.campana ? `entró por ${asignado.campana}` : 'Sin campaña'}</span>
                </div>
                {contacto.username && (
                    <IconButton label={`Abrir @${contacto.username} en Instagram`} data-tip="Abrir en Instagram" icon={<Instagram size={16} />}
                        onClick={() => window.open(`https://www.instagram.com/${encodeURIComponent(contacto.username)}/`, '_blank', 'noopener')} />
                )}
            </div>
            <Tramos avance={avance} ejecucion={datos.ejecucion} contacto={contacto} asignado={asignado} yo={yo} onCambio={onCambio} />
            <Feed mensajes={datos.mensajes} notas={datos.notas || []} tareas={datos.tareas || []} />
            <Composer contacto={contacto} ejecucion={datos.ejecucion} yo={yo} onCambio={onCambio} />
        </Panel>
    );
}

export default function Detalle({ id, yo, onLeido }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    // Cada conversación monta un Detalle nuevo (key={id}): arranca vacío. Se vuelve a pedir cada
    // REFRESCO, y después de cada acción del setter, sin vaciar lo que se ve.
    const pedir = useCallback(() => inboxApi.conversacion(id)
        .then((d) => { setDatos(d); setError(null); })
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

    if (error && !datos) return <Panel size="sm" className="cv-detalle"><EmptyState icon={<MessageSquare size={22} />}>{error}</EmptyState></Panel>;
    if (!datos) return <Panel size="sm" className="cv-detalle"><EmptyState>Cargando…</EmptyState></Panel>;
    return (
        <>
            <Chat datos={datos} yo={yo} onCambio={pedir} />
            <FichaLead contacto={datos.contacto} avance={datos.avance} asignado={datos.asignado} tareas={datos.tareas || []}
                recorrido={datos.recorrido || []} yo={yo} onCambio={pedir} />
        </>
    );
}
