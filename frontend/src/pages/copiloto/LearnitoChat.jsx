// El chat de Learnito: la lista de mensajes y el redactor con dictado por voz. Lo usan el modal (desde
// el dock) y la página /copiloto; la conversación es la de LearnitoContext, así que es la misma en los dos.
// Las respuestas del cerebro de la Academia vienen en markdown y pueden traer gráficos (ubicados en el texto con
// su marcador, [[A]]), botones u opciones para seguir y una acción para confirmar. La conversación se puede
// calificar para revisar después las que salieron mal. Abajo, la barra de uso de la conversación: al llenarse no se
// sigue escribiendo. Para abrir otra, las anteriores sin calificar se califican acá (Pendientes).
// "@" nombra a un cliente o a alguien del equipo, y un texto seleccionado (en el redactor o en una respuesta) se
// convierte en nombre con "Nombrar"; "/" al principio abre las acciones simples, que el cerebro arma sin IA
// (ADR-W012, menciones.js).
import { useEffect, useRef, useState } from 'react';
import { AtSign, Bell, Check, Copy, Frown, Meh, MessageSquare, Mic, MicOff, Send, Smile, Sparkles, X } from 'lucide-react';
import { Button, EmptyState, FieldError, IconButton, TextArea } from '../../components/standard';
import api from '../../services/api';
import { useLearnito } from '../../sesion/LearnitoContext';
import { juntar } from './dictado';
import Grafico from './Grafico';
import Markdown from './Markdown';
import { conMenciones, disparador, filtrarAcciones, insertar, seleccionValida } from './menciones';
import { useDictado } from './useDictado';
import UsoMensual from './UsoMensual';
import './copiloto.css';

const SUGERENCIAS = [
    'Mis agendas de hoy',
    '¿Quién me debe más?',
    'Show up por closer en los últimos 30 días',
];

const CALIFICACIONES = [
    { valor: 'insatisfactoria', texto: 'Insatisfactoria', icono: <Frown size={13} /> },
    { valor: 'regular', texto: 'Regular', icono: <Meh size={13} /> },
    { valor: 'satisfactoria', texto: 'Satisfactoria', icono: <Smile size={13} /> },
];

// Los botones y las opciones que el cerebro ofrece para seguir (solo en la última respuesta).
function Siguientes({ mensaje, indice, tocar, deshabilitado }) {
    const botones = (mensaje?.botones || []).map((b, i) => ({ ...b, tipo: 'boton', i }));
    // Las opciones llegan como texto ("No show (Agendas)"); los botones, como {texto, icono}.
    const opciones = (mensaje?.opciones || []).map((o, i) => ({ texto: typeof o === 'string' ? o : o?.texto, tipo: 'opcion', i }));
    const todos = [...opciones, ...botones].filter((b) => b.texto);
    if (!todos.length) return null;
    return (
        <div className="cp-siguientes">
            {todos.map((b) => (
                <Button key={`${b.tipo}${b.i}`} disabled={deshabilitado}
                    onClick={() => tocar(indice, b.tipo, b.i, b.texto)}>{b.texto}</Button>
            ))}
        </div>
    );
}

// El texto con sus gráficos: cada [[A]] se reemplaza por su gráfico; los que el texto no ubicó van al final.
function Respuesta({ texto, adjuntos }) {
    const graficos = adjuntos && typeof adjuntos === 'object' ? adjuntos : {};
    const partes = (texto || '').split(/\[\[([A-Z])\]\]/);
    const usados = new Set();
    const bloques = partes.map((p, i) => {
        if (i % 2 === 0) return p.trim() ? <Markdown key={i} texto={p} /> : null;
        if (!graficos[p] || usados.has(p)) return null;
        usados.add(p);
        return <Grafico key={i} adjunto={graficos[p]} />;
    });
    const resto = Object.keys(graficos).filter((id) => !usados.has(id) && graficos[id]?.tipo === 'grafico');
    return (
        <>
            {bloques}
            {resto.map((id) => <Grafico key={id} adjunto={graficos[id]} />)}
        </>
    );
}

// La acción que propuso la respuesta: se puede editar el texto y se hace recién al confirmar.
function Accion({ accion, confirmar }) {
    const [texto, setTexto] = useState(accion.texto || '');
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const hacer = async (opciones) => {
        setOcupado(true);
        setError(null);
        const fallo = await confirmar(opciones);
        setOcupado(false);
        if (fallo) setError(fallo);
    };
    const Icono = accion.tipo === 'aviso' ? Bell : MessageSquare;
    return (
        <div className={`cp-accion cp-accion--${accion.estado}`}>
            <p className="cp-accion__titulo"><Icono size={14} aria-hidden="true" /> {accion.titulo}</p>
            {(accion.detalle || []).map((d) => <p key={d} className="cp-accion__detalle">{d}</p>)}
            {accion.estado === 'propuesta' ? (
                <>
                    <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000}
                        aria-label="Texto de la acción" rows={3} />
                    <div className="cp-botones">
                        <Button variant="ghost" icon={<X size={14} />} disabled={ocupado}
                            onClick={() => hacer({ descartar: true })}>Descartar</Button>
                        <Button variant="primary" icon={<Check size={14} />} disabled={ocupado || !texto.trim()}
                            onClick={() => hacer({ texto: texto.trim() })}>Confirmar</Button>
                    </div>
                    {error && <FieldError>{error}</FieldError>}
                </>
            ) : (
                <>
                    <p className="cp-accion__texto">{accion.texto}</p>
                    <p className="cp-accion__estado">
                        {accion.estado === 'hecha' ? (accion.resultado || 'Hecho.') : 'Descartada.'}
                    </p>
                </>
            )}
        </div>
    );
}

// Las conversaciones anteriores sin calificar: hasta calificarlas no se puede empezar otra.
function Pendientes({ pendientes, calificar }) {
    return (
        <div className="cp-pendientes" role="group" aria-label="Conversaciones sin calificar">
            <p>Para empezar otra conversación, calificá {pendientes.length === 1 ? 'la anterior' : 'las anteriores'}:</p>
            {pendientes.map((p) => (
                <div key={p.id} className="cp-pendientes__fila">
                    <span className="cp-pendientes__titulo" title={p.titulo}>{p.titulo}</span>
                    {CALIFICACIONES.map((c) => (
                        <Button key={c.valor} size="sm" variant="ghost" icon={c.icono} onClick={() => calificar(p.id, c.valor)}>
                            {c.texto}
                        </Button>
                    ))}
                </div>
            ))}
        </div>
    );
}

function Mensaje({ role, content, mensaje, confirmar }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = () => navigator.clipboard?.writeText(content.replace(/\[\[[A-Z]\]\]/g, '').trim()).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
    });
    return (
        <li className={`cp-msg cp-msg--${role === 'user' ? 'closer' : 'copiloto'}`}>
            {mensaje ? (
                <div className="cp-texto">
                    <Respuesta texto={content} adjuntos={mensaje.adjuntos} />
                    {mensaje.accion && <Accion accion={mensaje.accion} confirmar={confirmar} />}
                </div>
            ) : <p className="cp-texto">{content}</p>}
            {role === 'assistant' && (
                <IconButton size="xs" icon={copiado ? <Check size={13} /> : <Copy size={13} />}
                    label={copiado ? 'Copiado' : 'Copiar respuesta'} onClick={copiar} />
            )}
        </li>
    );
}

export default function LearnitoChat() {
    const {
        mensajes, enviando, enviar, tocar, confirmar, agotado, uso, calificacion, calificar,
        pendientes, cargarPendientes, calificarPendiente, trabado,
        borrador: texto, setBorrador: setTexto,
    } = useLearnito();
    const bloqueado = agotado || trabado;
    const ultima = mensajes.length - 1;
    const respondio = mensajes.some((m) => m.role === 'assistant');
    const [error, setError] = useState(null);
    const tocarBoton = async (...args) => {
        setError(null);
        const fallo = await tocar(...args);
        if (fallo) setError(fallo);
    };
    const dictado = useDictado((frase) => setTexto((t) => juntar(t, frase)));
    const finRef = useRef(null);
    const caja = useRef(null);
    const listaRef = useRef(null);
    const reloj = useRef(null);
    const [acciones, setAcciones] = useState([]);
    const [nombrados, setNombrados] = useState([]);
    const [sugeridos, setSugeridos] = useState([]);
    const [marcado, setMarcado] = useState(0);
    const [rango, setRango] = useState(null);
    const [nadie, setNadie] = useState(false);
    const [seleccion, setSeleccion] = useState(null);

    useEffect(() => {
        api.get('/copiloto/learnito/acciones').then(({ data }) => setAcciones(data.acciones || [])).catch(() => {});
    }, []);

    const cerrarSugeridos = () => { setSugeridos([]); setRango(null); setNadie(false); };

    const buscar = (termino, nuevoRango) => {
        setRango(nuevoRango);
        clearTimeout(reloj.current);
        reloj.current = setTimeout(() => {
            api.get('/copiloto/learnito/personas', { params: { q: termino } }).then(({ data }) => {
                const lista = data.personas || [];
                setSugeridos(lista);
                setNadie(!lista.length);
                setMarcado(0);
            }).catch(() => cerrarSugeridos());
        }, 200);
    };

    // Lo que se escribe antes del cursor: "/" lista las acciones; "@" con dos letras busca.
    const revisar = (el) => {
        const d = disparador(el.value, el.selectionStart);
        if (d?.tipo === 'accion') {
            setRango(d);
            setSugeridos(filtrarAcciones(acciones, d.termino).map((a) => ({ ...a, tipo: 'accion' })));
            setMarcado(0);
            setNadie(false);
        } else if (d) {
            buscar(d.termino, d);
        } else {
            clearTimeout(reloj.current);
            cerrarSugeridos();
        }
    };

    const elegir = (item) => {
        const { valor, cursor } = insertar(texto, rango, item);
        setTexto(valor);
        if (item.tipo !== 'accion') {
            setNombrados((lista) => [...lista.filter((n) => !(n.id === item.id && n.tipo === item.tipo)), item]);
        }
        cerrarSugeridos();
        requestAnimationFrame(() => { caja.current?.focus(); caja.current?.setSelectionRange(cursor, cursor); });
    };

    // Un texto seleccionado en el redactor o en una respuesta: "Nombrar" lo busca como persona.
    useEffect(() => {
        const alSeleccionar = () => {
            const el = caja.current;
            if (el && document.activeElement === el) {
                const t = el.value.slice(el.selectionStart, el.selectionEnd).trim();
                setSeleccion(seleccionValida(t) ? { texto: t, inicio: el.selectionStart, fin: el.selectionEnd } : null);
                return;
            }
            const s = window.getSelection();
            const t = (s?.toString() || '').trim();
            const enRespuesta = s?.anchorNode?.parentElement?.closest('.cp-msg--copiloto');
            setSeleccion(seleccionValida(t) && enRespuesta && listaRef.current?.contains(enRespuesta) ? { texto: t } : null);
        };
        document.addEventListener('selectionchange', alSeleccionar);
        return () => document.removeEventListener('selectionchange', alSeleccionar);
    }, []);

    const nombrar = () => {
        const fin = texto.length;
        buscar(seleccion.texto, seleccion.inicio !== undefined ? { inicio: seleccion.inicio, fin: seleccion.fin }
            : { inicio: fin, fin, alFinal: true });
        setSeleccion(null);
    };

    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensajes, enviando]);
    // Al abrir sin conversación: las anteriores sin calificar, que traban la nueva.
    useEffect(() => { if (!mensajes.length) cargarPendientes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const mandar = async () => {
        const limpio = texto.trim();
        if (!limpio || enviando || bloqueado) return;
        dictado.detener();
        setTexto('');
        setError(null);
        cerrarSugeridos();
        const fallo = await enviar(conMenciones(limpio, nombrados), limpio);
        if (fallo) {
            setTexto(limpio);
            setError(fallo);
        } else {
            setNombrados([]);
        }
    };

    const alTeclear = (e) => {
        if (e.key === 'Escape' && (sugeridos.length || nadie || seleccion)) {
            e.preventDefault();
            e.stopPropagation();
            cerrarSugeridos();
            setSeleccion(null);
            return;
        }
        if (sugeridos.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setMarcado((m) => (m + (e.key === 'ArrowDown' ? 1 : -1) + sugeridos.length) % sugeridos.length);
            return;
        }
        if (sugeridos.length && (e.key === 'Enter' || e.key === 'Tab')) {
            e.preventDefault();
            elegir(sugeridos[marcado]);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            mandar();
        }
    };

    const mostrado = dictado.escuchando && dictado.parcial ? juntar(texto, dictado.parcial) : texto;

    return (
        <div className="learnito">
            {mensajes.length === 0 ? (
                <EmptyState icon={<Sparkles size={28} />} title="¿En qué te ayudo?"
                    action={(
                        <div className="cp-sugerencias">
                            {SUGERENCIAS.map((s) => <Button key={s} onClick={() => setTexto(s)}>{s}</Button>)}
                        </div>
                    )}>
                    Escribí o tocá el micrófono y hablá. Veo tus agendas, tus clientes y quién te debe, y los números
                    del equipo. Con @ nombrás a un cliente o a alguien del equipo, y con / dejás un comentario o un
                    aviso sin esperar a la IA: se hace cuando lo confirmes.
                </EmptyState>
            ) : (
                <ul className="cp-lista" aria-live="polite" ref={listaRef}>
                    {mensajes.map((m, i) => <Mensaje key={i} {...m} confirmar={(opciones) => confirmar(i, opciones)} />)}
                    {!enviando && mensajes[ultima]?.mensaje && (
                        <li className="cp-siguientes-fila">
                            <Siguientes mensaje={mensajes[ultima].mensaje} indice={mensajes[ultima].indice} tocar={tocarBoton}
                                deshabilitado={enviando || bloqueado} />
                        </li>
                    )}
                    {enviando && <li className="cp-msg cp-msg--copiloto cp-pensando">Pensando…</li>}
                    <li ref={finRef} aria-hidden="true" />
                </ul>
            )}

            <div className="cp-redactor">
                {trabado && <Pendientes pendientes={pendientes} calificar={calificarPendiente} />}
                <div className="cp-caja">
                    {(sugeridos.length > 0 || nadie) && (
                        <ul className="cp-sugeridos" role="listbox" aria-label="Sugerencias">
                            {sugeridos.map((s, i) => (
                                <li key={`${s.tipo}${s.id ?? s.clave}`} role="option" aria-selected={i === marcado}>
                                    <button type="button" className={i === marcado ? 'is-marcado' : ''}
                                        onMouseDown={(e) => { e.preventDefault(); elegir(s); }} onMouseEnter={() => setMarcado(i)}>
                                        <strong>{s.tipo === 'accion' ? `/${s.clave} · ${s.nombre}` : s.nombre}</strong>
                                        <span>{s.detalle}</span>
                                    </button>
                                </li>
                            ))}
                            {nadie && <li className="cp-sugeridos__nadie">Nadie con ese nombre.</li>}
                        </ul>
                    )}
                    {seleccion && !sugeridos.length && !nadie && (
                        <Button className="cp-nombrar" size="sm" icon={<AtSign size={13} />}
                            onMouseDown={(e) => { e.preventDefault(); nombrar(); }}>
                            Nombrar «{seleccion.texto}»
                        </Button>
                    )}
                    <TextArea ref={caja} value={mostrado} onChange={(e) => { setTexto(e.target.value); revisar(e.target); }}
                        onKeyDown={alTeclear} onClick={(e) => revisar(e.target)}
                        onBlur={() => setTimeout(cerrarSugeridos, 150)}
                        readOnly={dictado.escuchando} disabled={bloqueado} maxLength={4000} aria-label="Mensaje para Learnito"
                        placeholder={dictado.escuchando ? 'Te escucho…' : 'Escribí o dictá tu pedido; @ nombra a alguien y / abre las acciones'} />
                </div>
                <div className="cp-botones">
                    <IconButton
                        icon={dictado.escuchando ? <MicOff size={16} /> : <Mic size={16} />}
                        label={dictado.soportado ? (dictado.escuchando ? 'Dejar de dictar' : 'Dictar') : 'Dictado no disponible: usá Chrome o Edge'}
                        title={dictado.soportado ? undefined : 'Usá Chrome o Edge para dictar.'}
                        pressed={dictado.escuchando}
                        disabled={!dictado.soportado || enviando}
                        onClick={dictado.escuchando ? dictado.detener : dictado.empezar} />
                    <Button variant="primary" icon={<Send size={14} />} onClick={mandar}
                        disabled={!texto.trim() || enviando || dictado.escuchando || bloqueado}>
                        Enviar
                    </Button>
                </div>
                {(dictado.error || error) && <FieldError>{dictado.error || error}</FieldError>}
                {respondio && (
                    <div className="cp-calificar" role="group" aria-label="Calificar la conversación">
                        <span>¿Cómo viene la conversación?</span>
                        {CALIFICACIONES.map((c) => (
                            <Button key={c.valor} icon={c.icono} aria-pressed={calificacion === c.valor}
                                variant={calificacion === c.valor ? 'primary' : 'ghost'}
                                onClick={() => calificar(c.valor)}>{c.texto}</Button>
                        ))}
                    </div>
                )}
                <UsoMensual uso={uso} />
            </div>
        </div>
    );
}
