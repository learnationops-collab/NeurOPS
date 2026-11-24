// Simular la conversación completa desde Embudos (ADR-W204): escribís como el lead, contestás como setter con los
// pasos de la Guía, adelantás el reloj y ves salir los seguimientos. Corre en el servidor con el motor de verdad
// (flujos publicados) y el borrador de la Guía, sin mandar nada ni guardar nada (`app/automatizaciones/simulacion.py`).
// Cada cambio manda la lista entera de acciones y se vuelve a correr desde cero.
import { useEffect, useRef, useState } from 'react';
import { FlaskConical, RotateCcw, Send, Undo2 } from 'lucide-react';
import { Button, Chip, InputGroup, Modal, ModalHeader, Select, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { SALIDAS } from './useEmbudos';

const RELOJ = [1, 4, 12, 24];
const TIPO = { bot: 'Bot', setter: 'Setter', auto: 'Seguimiento · auto' };

function hora(inicio, h) {
    return new Date(inicio + h * 3600000).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function Item({ x, inicio, onBoton }) {
    if (x.tipo === 'evento') return <div className={`em-sim-ev em-sim-ev--${x.clase}`}>{x.texto}</div>;
    return (
        <div className={`em-msg em-msg--${x.tipo}`}>
            {TIPO[x.tipo] && <span className="em-msg-tag">{TIPO[x.tipo]}</span>}
            <span className="em-msg-txt">{x.texto}</span>
            {x.botones?.length > 0 && (
                <span className="em-msg-btns">
                    {x.botones.map((b, i) => (b.url
                        ? <a key={i} href={b.url} target="_blank" rel="noreferrer">{b.titulo} ↗</a>
                        : <button key={i} type="button" onClick={() => onBoton(b)}>{b.titulo}</button>))}
                </span>
            )}
            <span className="em-msg-h">{hora(inicio, x.en)}</span>
        </div>
    );
}

function pasosDeSetter(estado, embudo, borrador, guiaConversion) {
    const contenido = estado.embudo === embudo.id ? borrador : estado.embudo === 'conversion' ? guiaConversion?.contenido : null;
    return (contenido?.etapas?.[estado.fase]?.pasos || []).filter((p) => p.uso !== 'no se usa' && p.op?.[0]?.x);
}

export default function Simulador({ embudo, embudos, borrador, guiaConversion, onCerrar }) {
    const [acciones, setAcciones] = useState([]);
    const [res, setRes] = useState(null);
    const [corriendo, setCorriendo] = useState(false);
    const [texto, setTexto] = useState('');
    const [comoSetter, setComoSetter] = useState('');
    const [inicio] = useState(() => Date.now());
    const hilo = useRef(null);

    useEffect(() => {
        let vigente = true;
        setCorriendo(true);
        inboxApi.simularEmbudo(embudo.id, acciones, borrador)
            .then((r) => { if (vigente) setRes(r); })
            .catch((e) => { if (vigente) toast(e.response?.data?.message || 'No se pudo simular', 'error'); })
            .finally(() => { if (vigente) setCorriendo(false); });
        return () => { vigente = false; };
    }, [embudo.id, acciones, borrador]);
    useEffect(() => { if (hilo.current) hilo.current.scrollTop = hilo.current.scrollHeight; }, [res]);

    const sumar = (a) => setAcciones((l) => [...l, a]);
    const lead = (e) => { e.preventDefault(); if (!texto.trim()) return; sumar({ tipo: 'lead', texto }); setTexto(''); };
    const setter = (e) => { e.preventDefault(); if (!comoSetter.trim()) return; sumar({ tipo: 'setter', texto: comoSetter }); setComoSetter(''); };
    const estado = res?.estado;
    const sin = estado?.sin_contestar;
    const pasos = estado ? pasosDeSetter(estado, embudo, borrador, guiaConversion) : [];
    const actual = embudos.find((e) => e.id === estado?.embudo) || embudo;
    const opcionesFase = [
        ...actual.fases.map((f) => ({ value: `${actual.id}|${f.id}`, label: f.nombre })),
        ...SALIDAS.map((f) => ({ value: `${actual.id}|${f.id}`, label: f.nombre })),
        ...(actual.conversion ? [] : [{ value: 'conversion|conexion', label: 'Pasar a Conversión · Conexión' }]),
    ];
    return (
        <Modal onClose={onCerrar} className="em-sim-modal" labelledBy="em-sim-t">
            <ModalHeader icon={<FlaskConical size={18} />} titleId="em-sim-t" title={`Simular conversación · ${embudo.nombre}`}
                subtitle="Con los flujos publicados y el borrador de la Guía. No sale nada a Instagram ni queda guardado." onClose={onCerrar}
                actions={(
                    <>
                        <Button variant="ghost" icon={<Undo2 />} disabled={!acciones.length} onClick={() => setAcciones((l) => l.slice(0, -1))}>Deshacer</Button>
                        <Button variant="ghost" icon={<RotateCcw />} disabled={!acciones.length} onClick={() => setAcciones([])}>Reiniciar</Button>
                    </>
                )} />
            <div className="em-sim">
                <div className="em-sim-chat">
                    <div className="em-sim-hilo" ref={hilo} aria-busy={corriendo}>
                        {!res?.items?.length && <p className="t-cap mut em-sim-vacio">Escribí el primer mensaje del lead, por ejemplo una palabra clave de una campaña o «Hola, info».</p>}
                        {res?.items?.map((x, i) => (
                            <Item key={i} x={x} inicio={inicio}
                                onBoton={(b) => sumar({ tipo: 'boton', payload: b.payload, titulo: b.titulo, rapida: !!b.rapida })} />
                        ))}
                    </div>
                    <InputGroup as="form" onSubmit={lead} className="em-sim-caja">
                        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí como el lead…" aria-label="Mensaje del lead" />
                        <Button type="submit" variant="primary" icon={<Send />} disabled={!texto.trim() || corriendo}>Enviar</Button>
                    </InputGroup>
                </div>
                <div className="em-sim-lado">
                    {estado && (
                        <div className="em-sim-estado">
                            <div><span>Embudo · fase</span><b>{estado.embudo_nombre} · {[...actual.fases, ...SALIDAS].find((f) => f.id === estado.fase)?.nombre || estado.fase}</b></div>
                            <div><span>Sin contestar hace</span><b>{sin == null ? '–' : `${Math.round(sin * 10) / 10} h`}</b></div>
                            <div><span>Ventana de 24 h</span><b>{sin == null ? '–' : sin < 24 ? `quedan ${Math.round((24 - sin) * 10) / 10} h` : 'cerrada'}</b></div>
                            <div><span>Próximo seguimiento</span><b>{estado.proximo ? hora(inicio, estado.proximo.en) : 'ninguno'}</b></div>
                            {estado.bot_pausado && <Chip subtle color="var(--warning)">Bot pausado: escribió el setter</Chip>}
                        </div>
                    )}
                    <div className="em-sim-bloque">
                        <span className="t-rotulo">Adelantar el reloj</span>
                        <div className="em-sim-fila">
                            {RELOJ.map((h) => <Button key={h} size="sm" disabled={corriendo} onClick={() => sumar({ tipo: 'reloj', horas: h })}>+{h} h</Button>)}
                            <Button size="sm" disabled={corriendo || !estado?.proximo}
                                onClick={() => sumar({ tipo: 'reloj', horas: estado.proximo.en - estado.ahora + 0.01 })}>Hasta el próximo seguimiento</Button>
                        </div>
                    </div>
                    <div className="em-sim-bloque">
                        <span className="t-rotulo">Contestar como setter</span>
                        {pasos.map((p) => (
                            <button key={p.id} type="button" className="em-sim-paso" disabled={corriendo}
                                onClick={() => sumar({ tipo: 'setter', texto: p.op[0].x.replace(/\{nombre\}/g, 'Valen'), guia: `${estado.fase}:${p.id}:0` })}>
                                <span>/{p.atajo} · {p.t}</span>{p.op[0].x}
                            </button>
                        ))}
                        {estado && !pasos.length && <p className="t-cap mut">Esta fase no tiene pasos en la Guía.</p>}
                        <InputGroup as="form" onSubmit={setter}>
                            <input value={comoSetter} onChange={(e) => setComoSetter(e.target.value)} placeholder="O escribí como setter…" aria-label="Mensaje del setter" />
                            <Button type="submit" disabled={!comoSetter.trim() || corriendo}>Mandar</Button>
                        </InputGroup>
                    </div>
                    <div className="em-sim-bloque">
                        <span className="t-rotulo">Mover de fase</span>
                        <Select size="sm" value={estado ? `${estado.embudo}|${estado.fase}` : ''} label="Mover de fase"
                            onChange={(v) => { const [e, f] = v.split('|'); sumar({ tipo: 'fase', embudo: e, fase: f }); }}
                            options={opcionesFase} />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
