// La tarjeta del lead, arriba de la columna derecha (ADR-W184): lo que antes iba en la cabecera del chat. Quién es,
// si califica e Instagram; a quién está asignada (tocarlo delega) y su canal (lo usa el reporte); las etiquetas; y
// la etapa del setting como desplegable, con «Adelantar» debajo.
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronsRight, Instagram } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Avatar, Button, Chip, IconButton, Panel, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import MenuBot, { EJECUCION } from './AccionesFlujo';
import { examenDe, quien } from './colas';
import Etiquetas from './Etiquetas';
import { Califica } from './Fila';
import { FASES, TRAMOS, colorDe, faseDe, ordenDe, siguiente } from './fasesSetting';
import useEquipo from './useEquipo';

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
            <button type="button" className={`cv-asignado cv-tarjeta-delegar${mio ? ' cv-asignado--mio' : ''}${asignado ? '' : ' cv-asignado--sin'}`}
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
            <Chip as="button" type="button" subtle color="var(--info)" aria-expanded={d.abierto} data-tip="Canal|Lo usa el reporte del día"
                onClick={() => d.setAbierto((a) => !a)}>
                {rotulo}{campana ? ` · ${campana}` : ''}<ChevronDown size={11} aria-hidden="true" />
            </Chip>
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

// La etapa del setting: cerrada muestra la actual; abierta, todas las fases por etapa y las salidas.
function Etapa({ fase, onMover }) {
    const d = useDesplegable();
    const f = faseDe(fase);
    const sig = siguiente(fase);
    const grupo = (tramo) => FASES.filter((x) => x.tramo === tramo);
    return (
        <>
            <div className="cv-tarjeta-pop-caja" ref={d.caja}>
                <button type="button" className="cv-etapa-btn" style={{ '--c': colorDe(f) }} aria-expanded={d.abierto} onClick={() => d.setAbierto((a) => !a)}>
                    <span className="cv-etapa-n">{f.n}</span>
                    <span className="cv-etapa-t"><b>{TRAMOS[f.tramo].nombre}</b><small>{f.label}</small></span>
                    <ChevronDown size={15} aria-hidden="true" />
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
                                            {x.guion.length > 1 && <span className="t-cap mut40">{x.guion.length} mensajes</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {sig && (
                <Button variant="primary" className="cv-adelantar" icon={<ChevronsRight />} onClick={() => onMover(sig.id)}>
                    Adelantar a {sig.n} · {sig.corto || sig.label}
                </Button>
            )}
        </>
    );
}

export default function TarjetaLead({ datos, fase, canal, yo, onCambio, onMover }) {
    const { contacto, asignado } = datos;
    const examen = examenDe({ examen: contacto.variables?.examen });
    const nombre = contacto.variables?.nombre || contacto.nombre;
    const ejecucion = datos.ejecucion;
    return (
        <Panel as="section" size="sm" className="cv-tarjeta" aria-label="El lead">
            <div className="cv-tarjeta-quien">
                <Avatar name={contacto.username || contacto.nombre || '?'} />
                <div className="cv-tarjeta-nombre">
                    <h3 className="t-h3">{quien(contacto)}</h3>
                    <span className="cv-chat-linea">
                        {[nombre, examen].filter(Boolean).length > 0 && <span className="t-cap mut">{[nombre, examen].filter(Boolean).join(' · ')}</span>}
                        <Califica valor={contacto.variables?._califica} />
                    </span>
                </div>
                {contacto.username && (
                    <IconButton size="sm" label={`Abrir @${contacto.username} en Instagram`} data-tip="Abrir en Instagram" icon={<Instagram size={15} />}
                        onClick={() => window.open(`https://www.instagram.com/${encodeURIComponent(contacto.username)}/`, '_blank', 'noopener')} />
                )}
            </div>
            <div className="cv-tarjeta-fila">
                <Delegar contacto={contacto} asignado={asignado} yo={yo} onCambio={onCambio} />
                <Canal contacto={contacto} canal={canal} campana={asignado?.campana} onCambio={onCambio} />
            </div>
            <Etiquetas contactoId={contacto.id} etiquetas={datos.etiquetas || []} onCambio={onCambio} />
            <Etapa fase={fase} onMover={onMover} />
            <MenuBot contacto={contacto} ejecucion={ejecucion} onCambio={onCambio} className="cv-tarjeta-bot">
                <span className="t-cap mut">Bot: {ejecucion ? `${ejecucion.flujo} · ${(EJECUCION[ejecucion.estado]?.texto || ejecucion.estado).toLowerCase()}` : 'ningún flujo arrancó'}</span>
                <ChevronDown size={12} aria-hidden="true" />
            </MenuBot>
        </Panel>
    );
}
