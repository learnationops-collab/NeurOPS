import { useEffect, useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Layers, PencilLine, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import Modal from '../../../../components/ui/Modal';
import Desplegable from '../../../../components/ficha/historial/Desplegable';
import { etiquetaDeFuente } from '../../../../components/ficha/fuentes';
import { Esqueleto, Hueso } from '../../../../components/huesos/Huesos';
import { fmt } from '../Shared';
import './agendasLote.css';

/**
 * «Editar en lote» las agendas tildadas en Revisar (10/10/2026).
 *
 * Es la edición masiva del Tablero de Agendas que Operaciones tenía en sus tablas viejas, ahora como
 * acción de lote de la tabla Agendas (ver `operacion.js`). Cambia la fuente, el closer y el estado
 * pre call; el Call Confirmer de la vieja no está, porque ya no se usa: los closers confirman sus
 * propias agendas.
 *
 * El backend (`POST /comercial/agendas/lote`) corrige cada agenda con la misma lógica que la ficha,
 * así que lo que se ve acá es lo que diría la ficha de cada una. Cada campo arranca en «No cambiar» y
 * solo viaja lo que se eligió; antes de aplicar se lee qué va a pasar («12 agendas: closer → Nerina,
 * fuente → Workshop»).
 *
 * El `Modal` va por portal a `body`, fuera del `.dc-shell` del tablero: el cuerpo y el pie llevan su
 * propio `.dc-shell dc-shell--embebido`, que trae los tokens, `.btn` y `.ln-field` sin el alto ni el
 * fondo de página (mismo recurso que `ModalConfirmacion`, que se monta con la clase del shell).
 */

const OPCIONES = '/comercial/agendas/lote/opciones';
const LOTE = '/comercial/agendas/lote';

/** «No cambiar»: el valor vacío de cada desplegable. Es lo que NO viaja en el pedido. */
export const SIN_CAMBIOS = { closer_id: '', fuente: '', pre_call: '' };

/** El cuerpo del POST: los ids de las filas y solo los campos que se eligieron. */
export const pedidoDeLote = (filas, elegidos) => {
    const cambios = {};
    if (elegidos.closer_id) cambios.closer_id = Number(elegidos.closer_id);
    if (elegidos.fuente) cambios.fuente = elegidos.fuente;
    if (elegidos.pre_call) cambios.pre_call = elegidos.pre_call;
    return { ids: filas.map(f => f.id), cambios };
};

/** Lo que se va a cambiar, legible y en el orden del formulario: «closer → Nerina», … */
export const cambiosLegibles = (elegidos, opciones) => {
    const partes = [];
    if (elegidos.closer_id) {
        const closer = (opciones?.closers || []).find(c => String(c.id) === String(elegidos.closer_id));
        partes.push(`closer → ${closer?.nombre || elegidos.closer_id}`);
    }
    if (elegidos.fuente) partes.push(`fuente → ${etiquetaDeFuente(opciones?.fuentes || [], elegidos.fuente)}`);
    if (elegidos.pre_call) {
        const estado = (opciones?.pre_call || []).find(e => e.key === elegidos.pre_call);
        partes.push(`pre call → ${estado?.label || elegidos.pre_call}`);
    }
    return partes;
};

/** «12 agendas: closer → Nerina, fuente → Workshop», o null si todo sigue en «No cambiar». */
export const resumenDeLote = (cantidad, elegidos, opciones) => {
    const partes = cambiosLegibles(elegidos, opciones);
    return partes.length ? `${fmt.plural(cantidad, 'agenda', 'agendas')}: ${partes.join(', ')}` : null;
};

/**
 * El toast del final: cuántas cambiaron, cuántas ya lo tenían y, si alguna no se pudo, el motivo de
 * la primera con el nombre del lead (el id solo no le dice nada a nadie).
 */
export const mensajeDelResultado = (resultado, filas = []) => {
    const { cambiadas = 0, sin_cambios: sinCambios = 0, errores = [] } = resultado || {};
    const partes = [fmt.plural(cambiadas, 'agenda actualizada', 'agendas actualizadas')];
    if (sinCambios) partes.push(`${fmt.num(sinCambios)} ya lo tenía${sinCambios === 1 ? '' : 'n'}`);
    if (!errores.length) return { tipo: 'success', texto: partes.join(' · ') };
    const [primero] = errores;
    const quien = filas.find(f => f.id === primero.id)?.cliente;
    const motivo = quien ? `${quien}: ${primero.message}` : primero.message;
    partes.push(`${fmt.plural(errores.length, 'no se pudo cambiar', 'no se pudieron cambiar')} (${motivo})`);
    return { tipo: 'error', texto: partes.join(' · ') };
};

/** Un campo del formulario: rótulo, para qué sirve y su desplegable, que arranca en «No cambiar». */
const Campo = ({ id, rotulo, ayuda, valor, onCambiar, disabled, children }) => (
    <div className={`op-lote-campo${valor ? ' op-lote-campo--on' : ''}`}>
        <div className="op-lote-campo-cab">
            <label className="t-rotulo" htmlFor={id}>{rotulo}</label>
            <small className="t-cap mut">{ayuda}</small>
        </div>
        <Desplegable id={id} etiqueta={rotulo} valor={valor} onCambiar={onCambiar} disabled={disabled}>
            <option value="">No cambiar</option>
            {children}
        </Desplegable>
    </div>
);

/** La forma de los tres campos mientras llegan las opciones. */
const CamposCargando = () => (
    <Esqueleto rotulo="Cargando las opciones" className="op-lote-campos">
        {[0, 1, 2].map(i => (
            <div key={i} className="op-lote-campo">
                <Hueso alto={12} ancho={96} paso={i} />
                <Hueso alto={44} radio={16} paso={i} />
            </div>
        ))}
    </Esqueleto>
);

export const PanelEditarEnLote = ({ filas = [], onCerrar, onHecho }) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const [opciones, setOpciones] = useState(null);
    const [sinOpciones, setSinOpciones] = useState(false);
    const [intento, setIntento] = useState(0);
    const [elegidos, setElegidos] = useState(SIN_CAMBIOS);
    const [aplicando, setAplicando] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let vigente = true;
        api.get(OPCIONES)
            .then(({ data }) => { if (vigente) setOpciones(data); })
            .catch(() => { if (vigente) setSinOpciones(true); });
        // Una respuesta que llega con el panel ya cerrado no escribe nada.
        return () => { vigente = false; };
    }, [intento]);

    const cantidad = filas.length;
    const resumen = useMemo(() => resumenDeLote(cantidad, elegidos, opciones),
        [cantidad, elegidos, opciones]);
    const limite = opciones?.limite;
    const excede = !!limite && cantidad > limite;
    const puedeAplicar = !!opciones && !!resumen && cantidad > 0 && !excede && !aplicando;
    const elegir = (campo) => (valor) => { setError(null); setElegidos(e => ({ ...e, [campo]: valor })); };

    const aplicar = async (e) => {
        e?.preventDefault();
        if (!puedeAplicar) return;
        setAplicando(true);
        setError(null);
        try {
            const { data } = await api.post(LOTE, pedidoDeLote(filas, elegidos));
            const { tipo, texto } = mensajeDelResultado(data, filas);
            toast[tipo](texto, { duration: tipo === 'error' ? 8000 : 4000 });
            onHecho?.();
            onCerrar?.();
        } catch (err) {
            // El pedido entero rebotó (permiso, un valor que ya no sirve): el motivo se dice ADENTRO
            // del panel, que sigue abierto con lo elegido, y no en un toast detrás del velo.
            setError(err?.response?.data?.message || 'No se pudo aplicar la edición en lote.');
            setAplicando(false);
        }
    };

    const entrada = reducido ? {} : {
        initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
    };

    return (
        <Modal tono="tema" ancho="lg" titulo="Editar en lote" onCerrar={onCerrar} onSubmit={aplicar}
            cerrable={!aplicando}
            subtitulo={fmt.plural(cantidad, 'agenda seleccionada', 'agendas seleccionadas')}
            icono={<Layers size={18} className="text-pink-400" />}
            pie={(
                <div className="dc-shell dc-shell--embebido op-lote-pie">
                    <button type="button" className="btn btn--linea" disabled={aplicando} onClick={onCerrar}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn--cta" disabled={!puedeAplicar}>
                        {aplicando && <span className="ln-spinner" aria-hidden="true" />}
                        {aplicando ? 'Aplicando…' : `Aplicar a ${fmt.plural(cantidad, 'agenda', 'agendas')}`}
                    </button>
                </div>
            )}>
            <div className="dc-shell dc-shell--embebido op-lote">
                <p className="t-sm mut">
                    Lo que elijas se aplica a cada agenda tildada, igual que si la corrigieras desde su
                    ficha. Lo que quede en «No cambiar» no se toca.
                </p>

                {sinOpciones && (
                    <div className="op-lote-aviso" role="alert">
                        <span>No se pudieron cargar las opciones.</span>
                        <button type="button" className="btn btn--linea btn--sm" onClick={() => { setSinOpciones(false); setIntento(n => n + 1); }}>
                            <RotateCcw aria-hidden="true" />
                            Reintentar
                        </button>
                    </div>
                )}
                {!sinOpciones && !opciones && <CamposCargando />}
                {opciones && (
                    <div className="op-lote-campos">
                        <Campo id={`${ids}-closer`} rotulo="Closer" ayuda="Quién atiende la llamada."
                            valor={elegidos.closer_id} onCambiar={elegir('closer_id')} disabled={aplicando}>
                            {(opciones.closers || []).map(c => (
                                <option key={c.id} value={String(c.id)}>
                                    {c.pista ? `${c.nombre} · ${c.pista}` : c.nombre}
                                </option>
                            ))}
                        </Campo>
                        <Campo id={`${ids}-fuente`} rotulo="Fuente" ayuda="El embudo o el setter que la trajo."
                            valor={elegidos.fuente} onCambiar={elegir('fuente')} disabled={aplicando}>
                            {(opciones.fuentes || []).map(g => (
                                <optgroup key={g.titulo} label={g.titulo}>
                                    {(g.opciones || []).map(o => (
                                        <option key={o.clave} value={o.clave}>{o.label}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </Campo>
                        <Campo id={`${ids}-pre`} rotulo="Estado pre call"
                            ayuda="«Canceló» no va en lote: cada cancelación lleva su motivo."
                            valor={elegidos.pre_call} onCambiar={elegir('pre_call')} disabled={aplicando}>
                            {(opciones.pre_call || []).map(e => (
                                <option key={e.key} value={e.key}>{e.label}</option>
                            ))}
                        </Campo>
                    </div>
                )}

                <div className={`op-lote-resumen${resumen ? ' op-lote-resumen--listo' : ''}`}
                    role="status" aria-live="polite" aria-label="Resumen del cambio">
                    <PencilLine aria-hidden="true" />
                    <motion.span key={resumen || 'nada'} {...entrada}>
                        {resumen || 'Elegí qué cambiar: todavía no hay nada para aplicar.'}
                    </motion.span>
                </div>

                {excede && (
                    <p className="op-lote-error t-sm" role="alert">
                        {`Se pueden editar hasta ${fmt.num(limite)} agendas por lote: destildá algunas.`}
                    </p>
                )}
                {error && <p className="op-lote-error t-sm" role="alert">{error}</p>}
            </div>
        </Modal>
    );
};

/** El aporte a `MODULOS` (ver `operacion.js`): una acción de lote en la tabla Agendas. */
const agendasLote = {
    agendas: {
        lote: [{ id: 'editar-en-lote', label: 'Editar en lote', Icono: PencilLine, Panel: PanelEditarEnLote }],
    },
};

export default agendasLote;
