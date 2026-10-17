import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { Segmented } from '../../../../components/standard';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import Cifra from '../../../comercial/components/Cifra';
import { EsqueletoFilas, EsqueletoTablero, PanelCab, Tip } from '../../../comercial/components/Shared';
import {
    AGRUPABLES, COLUMNAS, FACETAS, ORDEN_ESTADOS, Estado, buscarEnEntrante, fechaHora,
} from './columnas';
import './entrantes.css';

/**
 * Marketing › Entrantes (16/10/2026, antes «Webhooks»): la base de leads que entran por ManyChat, UNA fila
 * por persona, con su estado (calificado, en conversación, sin respuesta, descalificado) y en qué paso del
 * flujo de Instagram va. Se filtra, se agrupa y se eligen columnas como en las demás listas. Clic en una
 * fila: su historial de webhooks.
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

/** El historial de webhooks de una persona, de más nuevo a más viejo. */
const CORREGIR = [
    { value: 'calificado', label: 'Calificado' },
    { value: 'descalificado', label: 'Descalificado' },
    { value: 'sin_dato', label: 'Sin dato' },
];
const calificacionDe = (estado) => (estado === 'calificado' || estado === 'descalificado' ? estado : 'sin_dato');

const idDe = (valor) => {
    const id = String(valor ?? '').trim();
    return id === '0' || id === '0.0' ? '' : id;
};

/**
 * Un webhook en palabras. ManyChat manda el mensaje que envió (`id_option_send`) y el que contestó la
 * persona (`id_option`); sin ninguno, es el inicio de la automatización. Con el mismo número en los dos
 * es el envío, no una respuesta: llega a los 30 s del inicio, igual que el envío solo.
 */
const PasoDeHistoria = ({ h, nombreDe }) => {
    const enviado = nombreDe(idDe(h.id_option_send));
    const respondido = idDe(h.id_option) !== idDe(h.id_option_send) ? nombreDe(idDe(h.id_option)) : null;
    if (!enviado && !respondido) return 'Inicio de la automatización';
    return (
        <>
            {respondido && <>Respondió <b>{respondido}</b></>}
            {respondido && enviado && ' · '}
            {enviado && <>{respondido ? 'se' : 'Se'} le mandó <b>{enviado}</b></>}
        </>
    );
};

const Ficha = ({ fila, mensajes, onCerrar, onCorregir }) => {
    const reducir = useReducedMotion();
    const [historia, setHistoria] = useState(null);
    useEffect(() => {
        const control = new AbortController();
        api.get('/manychat-webhook/log', { params: { lead_id: fila.lead_id, limit: 200 }, signal: control.signal })
            .then((r) => setHistoria(r.data))
            .catch((e) => { if (e?.name !== 'CanceledError') setHistoria([]); });
        return () => control.abort();
    }, [fila.lead_id]);
    const nombreDe = (id) => (id ? (mensajes[id]?.titulo || `Mensaje ${id}`) : null);
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
            <div className="en-corregir">
                <span className="t-rotulo">Calificación</span>
                <Segmented size="sm" label="Corregir la calificación" options={CORREGIR}
                    value={calificacionDe(fila.estado)} onChange={onCorregir} />
            </div>
            {!historia ? <EsqueletoFilas rotulo="Cargando el historial…" lineas={3} alto={22} /> : (
                <ol className="en-historia">
                    {historia.map((h) => (
                        <li key={h.id}>
                            <span className="num mut40">{fechaHora(h.created_at)}</span>
                            <span className="en-historia-paso"><PasoDeHistoria h={h} nombreDe={nombreDe} /></span>
                            {h.qualification === 'true' && <Estado estado="calificado" />}
                            {h.qualification === 'false' && <Estado estado="descalificado" />}
                        </li>
                    ))}
                </ol>
            )}
        </motion.div>
    );
};

const EntrantesVista = ({ desde, hasta, version = 0 }) => {
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

    // Corregir a mano: la fila toma el estado nuevo sin recargar la lista. «Sin dato» vuelve a en
    // conversación o sin respuesta según si contestó algún mensaje.
    const corregir = async (fila, valor) => {
        try {
            await api.put(`/manychat-webhook/lead/${fila.lead_id}/calificacion`, { estado: valor });
            const estado = valor !== 'sin_dato' ? valor : (fila.ultimo_respondido?.id ? 'en_conversacion' : 'sin_respuesta');
            const nueva = { ...fila, estado };
            setDatos((d) => ({ ...d, filas: d.filas.map((f) => (f.lead_id === fila.lead_id ? nueva : f)) }));
            setElegida(nueva);
        } catch (e) {
            toast.error(e.response?.data?.error || 'No se pudo corregir la calificación.');
        }
    };

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
                <Kpi i={2} titulo="Descalificados" valor={num(cuenta.descalificado)} tip="ManyChat los marcó no calificados."
                    sub={`${pct(cuenta.descalificado, total)} de los entrantes`} />
                <Kpi i={3} titulo="Pendientes" valor={num(cuenta.en_conversacion + cuenta.sin_respuesta)}
                    tip="Todavía sin calificar."
                    sub={`${num(cuenta.en_conversacion)} en conversación · ${num(cuenta.sin_respuesta)} sin respuesta`} />
            </div>

            <section className="panel en-lista" aria-label="Entrantes">
                <PanelCab titulo="Leads entrantes" tip="Una fila por persona. Clic: su historial." />
                {elegida && (
                    <Ficha key={elegida.lead_id} fila={elegida} mensajes={datos.mensajes || {}} onCerrar={() => setElegida(null)}
                        onCorregir={(valor) => corregir(elegida, valor)} />
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
