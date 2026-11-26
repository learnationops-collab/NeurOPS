// La tarjeta del lead, arriba de la columna derecha (ADR-W184, reordenada en ADR-W238): quién es (con el nombre que
// dejó al agendar si está en Work, y su número o su @), su última agenda; en una línea de pastillas a quién está
// asignada (tocarla delega), su canal (lo usa el reporte) y las etiquetas; y la etapa del setting con su avance y
// «Adelantar» al lado.
import { useEffect, useRef, useState } from 'react';
import { Bot, CalendarCheck, Check, ChevronDown, ChevronsRight, Instagram, Radio } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Avatar, Button, IconButton, Panel, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import MenuBot, { EJECUCION } from './AccionesFlujo';
import { esWhatsapp, examenDe, quien, usuarioDe } from './colas';
import Etiquetas from './Etiquetas';
import { Califica } from './Fila';
import { FASES, TRAMOS, colorDe, corto, faseDe, ordenDe, siguiente } from './fasesSetting';
import IconoCanal from './IconoCanal';
import { momento } from './Feed';
import useEquipo from './useEquipo';
import { pasosDe, useGuia, visibles } from '../guia/useGuia';

const CANALES = [['anuncios', 'Anuncios'], ['inbound', 'Inbound'], ['bienvenida', 'Bienvenida']];

function useDesplegable() {
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
    }, [abierto]);
    return { abierto, setAbierto, caja };
}

function Delegar({ contacto, asignado, yo, onCambio }) {
    const equipo = useEquipo();
    const d = useDesplegable();
    const pop = useEnPantalla();
    const elegir = async (id) => {
        d.setAbierto(false);
        try {
            await inboxApi.asignar(contacto.id, id);
            const quienEs = equipo.find((s) => s.id === id);
            toast(id == null ? 'Quedó sin asignar' : id === yo ? 'Volvió a vos' : `Delegada a ${quienEs?.nombre || 'otro setter'}`);
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo delegar', 'error');
        }
    };
    const mio = asignado?.id === yo;
    return (
        <div className="cv-tarjeta-pop-caja" ref={d.caja}>
            <button type="button" className={`cv-pastilla cv-asignado${mio ? ' cv-asignado--mio' : ''}${asignado ? '' : ' cv-asignado--sin'}`}
                aria-expanded={d.abierto} data-tip="Delegar|A quién le toca esta conversación" onClick={() => d.setAbierto((a) => !a)}>
                {asignado ? <Avatar name={asignado.username} size="xs" /> : null}
                {asignado ? (mio ? 'Vos' : asignado.username) : 'Sin asignar'}<ChevronDown size={12} aria-hidden="true" />
            </button>
            {d.abierto && (
                <div className="cv-tarjeta-pop" ref={pop} role="menu" aria-label="Delegar a">
                    <span className="t-rotulo">Delegar a</span>
                    {equipo.map((s) => (
                        <button key={s.id} type="button" className="cv-tarjeta-op" aria-checked={s.id === asignado?.id} role="menuitemradio" onClick={() => elegir(s.id)}>
                            <Avatar name={s.nombre} size="xs" />{s.id === yo ? 'Vos' : s.nombre}{s.id === asignado?.id && <Check size={13} />}
                        </button>
                    ))}
                    <button type="button" className="cv-tarjeta-op" onClick={() => elegir(null)}>Sin asignar</button>
                </div>
            )}
        </div>
    );
}

function Canal({ contacto, canal, campana, onCambio }) {
    const d = useDesplegable();
    const pop = useEnPantalla();
    const elegir = async (c) => {
        d.setAbierto(false);
        try {
            await inboxApi.marcarCanal(contacto.id, c);
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cambiar el canal', 'error');
        }
    };
    const rotulo = CANALES.find(([v]) => v === canal)?.[1] || 'Sin canal';
    return (
        <div className="cv-tarjeta-pop-caja" ref={d.caja}>
            <button type="button" className="cv-pastilla cv-pastilla--canal" aria-expanded={d.abierto}
                data-tip={`Canal|${campana ? `Campaña ${campana}. ` : ''}Lo usa el reporte del día`} onClick={() => d.setAbierto((a) => !a)}>
                <Radio size={12} aria-hidden="true" /><span className="cv-elipsis">{rotulo}</span><ChevronDown size={11} aria-hidden="true" />
            </button>
            {d.abierto && (
                <div className="cv-tarjeta-pop cv-tarjeta-pop--der" ref={pop} role="menu" aria-label="Canal">
                    <span className="t-rotulo">Canal (para el reporte)</span>
                    {CANALES.map(([v, l]) => (
                        <button key={v} type="button" className="cv-tarjeta-op" role="menuitemradio" aria-checked={v === canal} onClick={() => elegir(v)}>
                            {l}{v === canal && <Check size={13} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

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

// La etapa del setting: cerrada muestra la actual y su avance; abierta, todas las fases por etapa y las salidas.
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
                </button>
                {d.abierto && (
                    <div className="cv-tarjeta-pop cv-etapa-pop" role="menu" aria-label="Etapa del setting">
                        {['auto', 'manual', 'agenda', 'salida'].map((t) => (
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
                {f.tramo !== 'salida' && <Avance fase={fase} />}
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

export default function TarjetaLead({ datos, fase, canal, yo, onCambio, onMover }) {
    const { contacto, asignado, cliente } = datos;
    const examen = examenDe({ examen: contacto.variables?.examen });
    const wa = esWhatsapp(contacto);
    // El nombre que dejó al agendar le gana al del perfil (un «👻» en WhatsApp).
    const nombre = cliente?.nombre || contacto.variables?.nombre || quien(contacto);
    const perfil = quien(contacto);
    const usuario = wa ? `+${contacto.igsid.slice(3)}` : usuarioDe(contacto) || (contacto.username ? `@${contacto.username}` : null);
    const ejecucion = datos.ejecucion;
    const bot = ejecucion ? `${ejecucion.flujo} · ${(EJECUCION[ejecucion.estado]?.texto || ejecucion.estado).toLowerCase()}` : 'Sin flujo';
    return (
        <Panel as="section" size="sm" className="cv-tarjeta" aria-label="El lead">
            <div className="cv-tarjeta-quien">
                <span className="cv-tarjeta-avatar">
                    <Avatar name={nombre} />
                    <IconoCanal c={contacto} size={10} />
                </span>
                <div className="cv-tarjeta-nombre">
                    <h3 className="t-h3 cv-elipsis" data-tip={nombre !== perfil ? `En ${wa ? 'WhatsApp' : 'Instagram'} se llama|${perfil}` : undefined}>{nombre}</h3>
                    <span className="cv-tarjeta-sub">
                        {usuario && <span className="cv-elipsis">{usuario}</span>}
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
            <div className="cv-tarjeta-fila">
                <Delegar contacto={contacto} asignado={asignado} yo={yo} onCambio={onCambio} />
                <Canal contacto={contacto} canal={canal} campana={asignado?.campana} onCambio={onCambio} />
                <MenuBot contacto={contacto} ejecucion={ejecucion} onCambio={onCambio} className="cv-pastilla cv-pastilla--bot">
                    <span className="cv-pastilla-in" data-tip={`Bot|${bot}`}>
                        <Bot size={12} aria-hidden="true" /><span className="cv-elipsis">{ejecucion ? ejecucion.flujo : 'Sin bot'}</span>
                    </span>
                </MenuBot>
            </div>
            <Etiquetas contactoId={contacto.id} etiquetas={datos.etiquetas || []} onCambio={onCambio} />
            <Etapa fase={fase} onMover={onMover} />
        </Panel>
    );
}
