// La tarjeta del lead, arriba de la columna derecha (ADR-W184, reordenada en ADR-W238 y ADR-W246): arriba de todo, por
// dónde entró (canal y palabra clave, `Origen`); quién es (con el nombre que dejó al agendar si está en Work, y su
// número o su @), su última agenda; las etiquetas; y la etapa del setting con su avance, «Adelantar» al lado y abajo
// Transferir, No lead e In-abrible.
import { CalendarCheck, Check, ChevronDown, ChevronsRight, Instagram, MinusCircle, XCircle } from 'lucide-react';
import { Avatar, Button, IconButton, Panel, toast } from '../../../components/standard';
import { Ahora, BotLead, ResolverLead, Telefono } from './Ahora';
import { esWhatsapp, examenDe, quien, usuarioDe } from './colas';
import Etiquetas from './Etiquetas';
import { Califica } from './Fila';
import { FASES, TRAMOS, colorDe, corto, faseDe, ordenDe, siguiente } from './fasesSetting';
import IconoCanal from './IconoCanal';
import { momento } from './Feed';
import useDesplegable from './useDesplegable';
import Transferir from './Transferir';
import Origen from './Origen';
import RachaLead from './RachaLead';
import { pasosDe, useGuia, visibles } from '../guia/useGuia';

// El avance en el embudo: un segmento por fase, lleno hasta la actual con el color de su etapa. Entra creciendo.
function Avance({ fase }) {
    const embudo = FASES.filter((x) => x.tramo !== 'salida');
    const actual = ordenDe(fase);
    return (
        <span className="cv-avance" aria-hidden="true">
            {embudo.map((x, i) => (
                <i key={x.id} className={i <= actual ? 'cv-avance--on' : ''} style={{ '--c': colorDe(x), '--i': i }} />
            ))}
        </span>
    );
}

// La etapa del setting: cerrada muestra la actual y su avance (la barrita, adentro del botón desde el 26/11/2026); abierta, todas las fases por etapa y las salidas.
function Etapa({ fase, onMover }) {
    const d = useDesplegable();
    const f = faseDe(fase);
    const sig = siguiente(fase);
    const grupo = (tramo) => FASES.filter((x) => x.tramo === tramo);
    const guia = useGuia();
    const cuantos = (id) => visibles(pasosDe(guia, id)).length;
    return (
        <div className="cv-etapa">
            <div className="cv-tarjeta-pop-caja cv-etapa-caja" ref={d.caja}>
                <button type="button" className="cv-etapa-btn" style={{ '--c': colorDe(f) }} aria-expanded={d.abierto}
                    data-tip={`Etapa|${TRAMOS[f.tramo].nombre} · ${f.label}`} onClick={() => d.setAbierto((a) => !a)}>
                    <span className="cv-etapa-n">{f.n}</span>
                    <span className="cv-etapa-t"><b>{corto(f)}</b><small>{TRAMOS[f.tramo].nombre}</small></span>
                    <ChevronDown size={14} aria-hidden="true" />
                    {f.tramo !== 'salida' && <Avance fase={fase} />}
                </button>
                {d.abierto && (
                    <div className="cv-tarjeta-pop cv-etapa-pop" role="menu" aria-label="Etapa del setting">
                        {['auto', 'manual', 'agenda'].map((t) => (
                            <div key={t} className="cv-etapa-grupo">
                                <span className="t-rotulo">{TRAMOS[t].nombre}</span>
                                {grupo(t).map((x) => {
                                    const hecha = ordenDe(x.id) >= 0 && ordenDe(x.id) < ordenDe(fase);
                                    return (
                                        <button key={x.id} type="button" role="menuitemradio" aria-checked={x.id === fase}
                                            className={`cv-etapa-op${x.id === fase ? ' cv-etapa-op--actual' : ''}${hecha ? ' cv-etapa-op--hecha' : ''}`}
                                            style={{ '--c': colorDe(x) }} onClick={() => { d.setAbierto(false); onMover(x.id); }}>
                                            <span className="cv-etapa-n">{hecha ? <Check size={10} strokeWidth={3} /> : x.n}</span>
                                            <span>{x.label}</span>
                                            {cuantos(x.id) > 1 && <span className="t-cap mut40">{cuantos(x.id)} pasos</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {sig && (
                <Button variant="primary" className="cv-adelantar" icon={<ChevronsRight />} data-tip={`Adelantar|Pasa a ${sig.n} · ${sig.label}`}
                    onClick={() => onMover(sig.id)}>
                    {corto(sig)}
                </Button>
            )}
        </div>
    );
}

// No lead e In-abrible a un toque, fuera del desplegable (Mario, 26/11): el chat sale de la bandeja y el aviso
// trae «Deshacer» (vuelve a la etapa en que estaba).
function Salidas({ fase, onMover, transferir }) {
    if (faseDe(fase).tramo === 'salida') {
        return (
            <div className="cv-salidas">
                {transferir}
                <p className="cv-salidas-fuera t-cap">Fuera del embudo · <button type="button" onClick={() => onMover('conexion')}>Volver a Conexión</button></p>
            </div>
        );
    }
    const salir = async (id, rotulo) => {
        if (await onMover(id) === false) return;
        toast(`Marcado: ${rotulo}`, 'success', { label: 'Deshacer', onClick: () => onMover(fase) });
    };
    return (
        <div className="cv-salidas">
            {transferir}
            <button type="button" className="cv-accion cv-accion--salida" onClick={() => salir('nolead', 'No lead')} data-tip="No lead|Descalificado: sale de la bandeja">
                <XCircle size={13} aria-hidden="true" />No lead
            </button>
            <button type="button" className="cv-accion cv-accion--salida" onClick={() => salir('inabrible', 'In-abrible')} data-tip="In-abrible|No se le puede escribir: sale de la bandeja">
                <MinusCircle size={13} aria-hidden="true" />In-abrible
            </button>
        </div>
    );
}

// Su última agenda en Work, en una línea: con quién, cuándo y cómo terminó.
function Agenda({ agenda }) {
    if (!agenda) return null;
    const partes = [agenda.con, agenda.en && momento(agenda.en)].filter(Boolean).join(' · ');
    return (
        <span className="cv-tarjeta-agenda" data-tip={`Su última agenda|${partes}${agenda.resultado ? ` · ${agenda.resultado}` : ''}`}>
            <CalendarCheck size={12} aria-hidden="true" />
            <span className="cv-elipsis">{agenda.resultado || 'Agendó'}{agenda.con ? ` · ${agenda.con}` : ''}</span>
        </span>
    );
}

export default function TarjetaLead({ datos, fase, canal, yo, pausar, onPausar, onCambio, onMover }) {
    const { contacto, asignado, cliente } = datos;
    const examen = examenDe({ examen: contacto.variables?.examen });
    const wa = esWhatsapp(contacto);
    // El nombre que dejó al agendar le gana al del perfil (un «👻» en WhatsApp).
    const nombre = cliente?.nombre || contacto.variables?.nombre || quien(contacto);
    const perfil = quien(contacto);
    const usuario = !wa && (usuarioDe(contacto) || (contacto.username ? `@${contacto.username}` : null));
    return (
        <Panel as="section" size="sm" className="cv-tarjeta" aria-label="El lead">
            <div className="cv-bloque">
                <Origen contacto={contacto} entrada={datos.entrada} canal={canal} campana={asignado?.campana} onCambio={onCambio}>
                    <Ahora contacto={contacto} mensajes={datos.mensajes || []} compacto />
                </Origen>
                <div className="cv-tarjeta-quien">
                    <span className="cv-tarjeta-avatar">
                        <Avatar name={nombre} />
                        <IconoCanal c={contacto} size={10} />
                    </span>
                    <div className="cv-tarjeta-nombre">
                        <h3 className="t-h3 cv-elipsis" data-tip={nombre !== perfil ? `En ${wa ? 'WhatsApp' : 'Instagram'} se llama|${perfil}` : undefined}>{nombre}</h3>
                        <span className="cv-tarjeta-sub">
                            {wa ? <Telefono contacto={contacto} /> : usuario && <span className="cv-elipsis">{usuario}</span>}
                            {examen && <span className="cv-tarjeta-examen">{examen}</span>}
                            <Califica valor={contacto.variables?._califica} />
                        </span>
                    </div>
                    {contacto.username && !wa && (
                        <IconButton size="sm" label={`Abrir @${contacto.username} en Instagram`} data-tip="Abrir en Instagram" icon={<Instagram size={15} />}
                            onClick={() => window.open(`https://www.instagram.com/${encodeURIComponent(contacto.username)}/`, '_blank', 'noopener')} />
                    )}
                </div>
                <Agenda agenda={cliente?.agenda} />
                <RachaLead mensajes={datos.mensajes || []} />
            </div>
            <div className="cv-bloque cv-bloque--suave">
                <BotLead contacto={contacto} ejecucion={datos.ejecucion} pausar={pausar} onPausar={onPausar} onCambio={onCambio}>
                    <ResolverLead contacto={contacto} mensajes={datos.mensajes || []} onCambio={onCambio} />
                </BotLead>
            </div>
            <div className="cv-bloque">
                <Etiquetas contactoId={contacto.id} etiquetas={datos.etiquetas || []} onCambio={onCambio} />
            </div>
            <div className="cv-bloque">
                <Etapa fase={fase} onMover={onMover} />
                <Salidas fase={fase} onMover={onMover} transferir={<Transferir contacto={contacto} asignado={asignado} yo={yo} onCambio={onCambio} />} />
            </div>
        </Panel>
    );
}
