import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Wrench, X } from 'lucide-react';
import api from '../../../../services/api';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import Cifra from '../../../comercial/components/Cifra';
import { EsqueletoFilas, EsqueletoTablero, PanelCab, Tip } from '../../../comercial/components/Shared';
import {
    AGRUPABLES, COLUMNAS, ESTADOS, FACETAS, ORDEN_ESTADOS, Estado, buscarEnEntrante, categoriaDe, fechaHora,
} from './columnas';
import './entrantes.css';

/**
 * Marketing › Entrantes (16/10/2026, antes «Webhooks»): la base de leads que entran por ManyChat, UNA fila
 * por persona, con su estado (calificado, en conversación, sin respuesta, descalificado) y en qué paso del
 * flujo de Instagram va. Se filtra, se agrupa y se eligen columnas como en las demás listas. Clic en una
 * fila: su historial de webhooks.
 *
 * Las herramientas viejas del monitor (limpiar CUF, migrar, limpieza, reasignación masiva) siguen, detrás
 * de «Herramientas» (`onHerramientas`): la página las dibuja fuera del `.dc-shell`.
 */

// Como el resto del tablero: separador de miles y punto decimal en inglés («2,206», «66.1%»).
const num = (n) => (n ?? 0).toLocaleString('en-US');
const pct = (n, total) => (total ? `${((n / total) * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%` : '—');

const Kpi = ({ titulo, valor, sub, tip, i }) => {
    const reducir = useReducedMotion();
    return (
        <motion.section className="kpi en-kpi"
            initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 0.7, 0.2, 1] }}>
            <div className="kpi-cab">
                <p className="t-eyebrow">{titulo}</p>
                <Tip texto={tip} titulo={titulo} />
            </div>
            <div className="kpi-cifra">
                <Cifra valor={valor} className="kpi-n" desdeAnterior />
                <p className="kpi-sub">{sub}</p>
            </div>
        </motion.section>
    );
};

/** Los pendientes (en conversación + sin respuesta) por el último mensaje que les mandó ManyChat. */
const PorPaso = ({ filas }) => {
    const pasos = useMemo(() => {
        const pendientes = filas.filter((f) => f.estado === 'en_conversacion' || f.estado === 'sin_respuesta');
        const mapa = new Map();
        pendientes.forEach((f) => {
            const k = f.ultimo_enviado?.titulo || 'Sin mensaje';
            const p = mapa.get(k) || { paso: k, categoria: categoriaDe(f.ultimo_enviado), en_conversacion: 0, sin_respuesta: 0 };
            p[f.estado] += 1;
            mapa.set(k, p);
        });
        const lista = [...mapa.values()].map((p) => ({ ...p, total: p.en_conversacion + p.sin_respuesta }));
        return { lista: lista.sort((a, b) => b.total - a.total), total: pendientes.length };
    }, [filas]);
    if (!pasos.total) return null;
    const max = Math.max(...pasos.lista.map((p) => p.total));
    return (
        <section className="panel en-pasos" aria-label="Pendientes por paso">
            <PanelCab titulo="Pendientes por paso" tip="Dónde quedaron los que todavía no calificaron." />
            <div className="en-pasos-lista">
                {pasos.lista.map((p) => (
                    <div key={p.paso} className="en-paso">
                        <span className="en-paso-nombre">
                            <span className="trunc">{p.paso}</span>
                            {p.categoria && <small className="mut40">{p.categoria}</small>}
                        </span>
                        <span className="en-paso-barra" aria-hidden="true">
                            <i style={{ width: `${(p.en_conversacion / max) * 100}%`, background: ESTADOS.en_conversacion.c }} />
                            <i style={{ width: `${(p.sin_respuesta / max) * 100}%`, background: ESTADOS.sin_respuesta.c }} />
                        </span>
                        <span className="num en-paso-n">{num(p.total)}</span>
                    </div>
                ))}
            </div>
            <div className="mk-leyenda en-leyenda">
                <span><i style={{ background: ESTADOS.en_conversacion.c }} />En conversación</span>
                <span><i style={{ background: ESTADOS.sin_respuesta.c }} />Sin respuesta</span>
            </div>
        </section>
    );
};

/** El historial de webhooks de una persona, de más nuevo a más viejo. */
const Ficha = ({ fila, mensajes, onCerrar }) => {
    const reducir = useReducedMotion();
    const [historia, setHistoria] = useState(null);
    useEffect(() => {
        const control = new AbortController();
        api.get('/manychat-webhook/log', { params: { lead_id: fila.lead_id, limit: 200 }, signal: control.signal })
            .then((r) => setHistoria(r.data))
            .catch((e) => { if (e?.name !== 'CanceledError') setHistoria([]); });
        return () => control.abort();
    }, [fila.lead_id]);
    const nombreDe = (id) => (id && id !== '0' ? (mensajes[id]?.titulo || `Mensaje ${id}`) : null);
    return (
        <motion.div className="hundido en-ficha" aria-label={`Historial de ${fila.nombre || fila.ig}`}
            initial={reducir ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.7, 0.2, 1] }}>
            <div className="en-ficha-cab">
                <div className="en-ficha-quien">
                    <p className="t-h3">{fila.nombre || fila.ig}</p>
                    <span className="t-cap mut40">{fila.ig ? `@${fila.ig} · ` : ''}{fila.clave || 'Sin palabra clave'}{fila.setter ? ` · ${fila.setter}` : ''}</span>
                </div>
                <Estado estado={fila.estado} />
                <button type="button" className="ibtn ibtn--sm" onClick={onCerrar} aria-label="Cerrar el historial">
                    <X aria-hidden="true" />
                </button>
            </div>
            {!historia ? <EsqueletoFilas rotulo="Cargando el historial…" lineas={3} alto={22} /> : (
                <ol className="en-historia">
                    {historia.map((h) => (
                        <li key={h.id}>
                            <span className="num mut40">{fechaHora(h.created_at)}</span>
                            <span className="en-historia-paso">
                                {nombreDe(h.id_option_send) ? <>Se le mandó <b>{nombreDe(h.id_option_send)}</b></> : 'Webhook'}
                                {nombreDe(h.id_option) && <> · respondió <b>{nombreDe(h.id_option)}</b></>}
                            </span>
                            {h.qualification === 'true' && <Estado estado="calificado" />}
                            {h.qualification === 'false' && <Estado estado="descalificado" />}
                        </li>
                    ))}
                </ol>
            )}
        </motion.div>
    );
};

const EntrantesVista = ({ desde, hasta, version = 0, onHerramientas, herramientasAbiertas = false }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [elegida, setElegida] = useState(null);

    useEffect(() => {
        const control = new AbortController();
        api.get('/manychat-webhook/entrantes', { params: { desde, hasta }, signal: control.signal })
            .then((r) => { setDatos(r.data); setError(null); })
            .catch((e) => { if (e?.name !== 'CanceledError') setError('No se pudieron cargar los entrantes.'); });
        return () => control.abort();
    }, [desde, hasta, version]);

    const filas = useMemo(() => datos?.filas || [], [datos]);
    const cuenta = useMemo(() => Object.fromEntries(ORDEN_ESTADOS.map((e) => [e, filas.filter((f) => f.estado === e).length])), [filas]);
    const seguidores = filas.filter((f) => f.follower).length;
    const abrir = useCallback((f) => setElegida((actual) => (actual?.lead_id === f.lead_id ? null : f)), []);

    if (error) return <section className="panel"><p className="t-body">{error}</p></section>;
    if (!datos) return <EsqueletoTablero rotulo="Cargando los entrantes…" />;

    const total = filas.length;
    return (
        <div className="en-vista">
            <div className="pareja en-kpis" style={{ '--min': '220px', '--g': 'var(--s4)' }}>
                <Kpi i={0} titulo="Entrantes" valor={num(total)} tip="Personas con algún webhook en el período."
                    sub={`${num(seguidores)} ya seguían la cuenta`} />
                <Kpi i={1} titulo="Calificados" valor={num(cuenta.calificado)} tip="ManyChat los marcó calificados."
                    sub={`${pct(cuenta.calificado, total)} de los entrantes`} />
                <Kpi i={2} titulo="En conversación" valor={num(cuenta.en_conversacion)} tip="Respondieron, todavía sin calificar."
                    sub={`${pct(cuenta.en_conversacion, total)} de los entrantes`} />
                <Kpi i={3} titulo="Sin respuesta" valor={num(cuenta.sin_respuesta)} tip="No contestaron la apertura."
                    sub={cuenta.descalificado
                        ? `${pct(cuenta.sin_respuesta, total)} · ${cuenta.descalificado} descalificados`
                        : `${pct(cuenta.sin_respuesta, total)} de los entrantes`} />
            </div>

            <PorPaso filas={filas} />

            <section className="panel en-lista" aria-label="Entrantes">
                <PanelCab titulo="Leads entrantes" tip="Una fila por persona. Clic: su historial.">
                    {onHerramientas && (
                        <button type="button" className={`pastilla${herramientasAbiertas ? ' pastilla--on' : ''}`}
                            onClick={onHerramientas} aria-pressed={herramientasAbiertas}>
                            <Wrench size={15} aria-hidden="true" /> Herramientas
                        </button>
                    )}
                </PanelCab>
                {elegida && (
                    <Ficha key={elegida.lead_id} fila={elegida} mensajes={datos.mensajes || {}} onCerrar={() => setElegida(null)} />
                )}
                <ListaConfigurable columnas={COLUMNAS} facetas={FACETAS} agrupables={AGRUPABLES} filas={filas}
                    clave={(f) => f.lead_id} onAbrirFila={abrir} marcada={elegida?.lead_id ?? null}
                    buscar={buscarEnEntrante} buscarPlaceholder="Persona o @ig…"
                    claveGuardado="mk_entrantes_cols" vacio="No entró nadie en el período."
                    ordenInicial={{ key: 'ultima', dir: 'desc' }} />
            </section>
        </div>
    );
};

export default EntrantesVista;
