import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Flame, RefreshCw } from 'lucide-react';
import api from '../../../services/api';
import { EsqueletoFilas, Tip } from '../../comercial/components/Shared';
import TarjetaAgenda from './TarjetaAgenda';
import Premio from './Premio';
import SetterUnclaimedAgendas from './SetterUnclaimedAgendas';
import { mesCorto, mesSiguiente, mesesConCuenta, nombreDeMes, tituloDeMes } from './meses';
import './misAgendas.css';

/**
 * «Mis agendas»: la bandeja de palabras clave del setter, el aterrizaje de su espacio.
 *
 * Pedido de Kerwin (10/10/2026): las agendas que llegaron con la fuente del setter, para que les
 * ponga la palabra clave del anuncio por el que llegó cada lead, con un buscador rápido; la lista
 * "debe vaciarse" y al vaciarla, un premio "como en un juego". Qué agendas son y qué es "tener
 * palabra clave" lo decide el backend (`palabra_clave_service`): las del setter con la regla de sus
 * números, que Marketing todavía no atribuye.
 *
 * **Un mes por vez (11/10/2026).** «Tenés 149 pendientes, es una banda: estaría bueno el filtro de
 * este mes, que te llenen este mes y luego el mes pasado, y que le vayamos pidiendo de a poquito».
 * Abre en el mes actual (por fecha de creación, la de las «generadas») y muestra solo ese; arriba,
 * el selector con lo que falta en cada mes, del más nuevo al más viejo. Al vaciar un mes, el premio
 * y un botón para seguir con el próximo que tenga pendientes (ver `meses.js`); al vaciar todos, el
 * premio final. Nunca se muestra todo junto.
 *
 * El trabajo es de teclado: escribir el anuncio, Enter, y el foco pasa al buscador de la agenda que
 * sigue; con la última del mes, al botón del mes siguiente. Cada asignación se nota en el momento:
 * la tarjeta se va, "Te quedan" baja y la barra del mes se llena.
 *
 * Debajo, lo que antes estaba en la pestaña Historial y no tiene otro lugar: las agendas de setting
 * sin dueño para reclamar. Los links de agendamiento están en el menú de la sesión del dock. La
 * comisión del mes se fue a «Mis datos» (pedido del 11/10/2026: «me gusta que aparezca, pero no
 * acá: en sus datos»).
 *
 * `onResumen` le avisa al espacio el resumen (la marca del dock); `onVerDatos` lleva a "Mis datos"
 * desde el premio final.
 */
const MisAgendas = ({ onResumen, onVerDatos }) => {
    const reducir = useReducedMotion();
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    // null, 'mes' (vació el que miraba y quedan otros) o 'todo' (no queda ninguna): ver `Premio`.
    const [festejo, setFestejo] = useState(null);
    const [aviso, setAviso] = useState('');
    const [sinDueno, setSinDueno] = useState([]);
    // El mes que eligió en el selector; sin elegir, el actual.
    const [mesElegido, setMesElegido] = useState(null);
    const tarjetas = useRef(new Map());
    const premioRef = useRef(null);
    const llamadoRef = useRef(null);
    // Al cambiar de mes desde el premio, el foco va a la primera tarjeta del mes nuevo; al vaciar un
    // mes, al botón del que sigue (o al premio). Los dos con un efecto: el destino todavía no existe
    // cuando vuelve la asignación.
    const enfocarPrimera = useRef(false);
    const enfocarPremio = useRef(false);
    // La lista y el mes del último render: una respuesta que llega tarde (asignó dos seguidas) tiene
    // que ver la lista de ahora, no la de cuando se mandó.
    const listaRef = useRef([]);
    listaRef.current = datos?.pendientes || [];
    const mesRef = useRef(null);
    // Cada carga lleva su número y solo vale la última. Asignar también cuenta como una: una carga
    // que salió antes (la segunda del montaje, en desarrollo) puede volver DESPUÉS con la bandeja de
    // antes de asignar, o vaciarla antes de que llegue la respuesta y mostrar "al día" en vez del
    // festejo.
    const pedido = useRef(0);

    const cargar = useCallback(async () => {
        const mio = ++pedido.current;
        setError(false);
        try {
            const res = await api.get('/setter/palabras-clave');
            if (mio !== pedido.current) return;
            setDatos(res.data);
            setError(false);
            onResumen?.(res.data?.resumen);
        } catch {
            if (mio === pedido.current) setError(true);
        }
    }, [onResumen]);

    useEffect(() => {
        cargar();
        api.get('/setter/agendas/sin-asignar').then(r => setSinDueno(r.data || [])).catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const anuncioPorId = useMemo(() => new Map((datos?.anuncios || []).map(a => [a.id, a])), [datos?.anuncios]);

    const resumen = datos?.resumen || { pendientes: 0, hoy: 0, racha: 0 };
    const pendientes = useMemo(() => datos?.pendientes || [], [datos]);
    // Las pendientes de cada mes se cuentan con la lista que se ve: el selector baja en el momento.
    const meses = useMemo(() => mesesConCuenta(datos?.resumen, pendientes), [datos, pendientes]);
    // Sin meses (un backend anterior) la lista va entera, como antes.
    const porMes = meses.length > 0;
    const infoMes = porMes
        ? meses.find(m => m.mes === mesElegido) || meses.find(m => m.mes === datos?.resumen?.mes_actual) || meses[0]
        : null;
    const mes = infoMes?.mes || null;
    mesRef.current = mes;
    const delMes = porMes ? pendientes.filter(a => a.mes === mes) : pendientes;
    const siguiente = porMes ? mesSiguiente(meses, mes) : null;

    const irAlMes = useCallback((clave, { enfocar = false } = {}) => {
        setMesElegido(clave);
        setFestejo(null);
        setAviso('');
        enfocarPrimera.current = enfocar;
    }, []);

    useEffect(() => {
        if (!enfocarPrimera.current) return;
        enfocarPrimera.current = false;
        const primera = delMes[0];
        if (primera) tarjetas.current.get(primera.id)?.focus();
    }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!enfocarPremio.current || delMes.length) return;
        enfocarPremio.current = false;
        (llamadoRef.current || premioRef.current)?.focus();
    });

    const asignar = async (agenda, anuncio, instagram) => {
        pedido.current += 1;
        try {
            const res = await api.post('/setter/palabras-clave', {
                appointment_id: agenda.id, ad_id: anuncio.id, ...(instagram !== undefined ? { instagram } : {}),
            });
            const respuesta = res.data?.resumen;
            const lista = listaRef.current;
            const mesAhora = mesRef.current;
            const visibles = mesAhora ? lista.filter(a => a.mes === mesAhora) : lista;
            const i = visibles.findIndex(a => a.id === agenda.id);
            const sigTarjeta = visibles[i + 1] || visibles[i - 1] || null;
            const quedanMes = visibles.filter(a => a.id !== agenda.id).length;
            const quedan = lista.filter(a => a.id !== agenda.id).length;
            // Entraron otras mientras trabajaba: no hay festejo, hay más trabajo.
            const masTrabajo = quedan === 0 && respuesta && respuesta.pendientes > 0;
            // El festejo se prende ANTES de vaciar la lista: si no, por un instante se veía "al día",
            // que es lo de quien entra y ya la encuentra vacía.
            if (quedanMes === 0 && !masTrabajo) setFestejo(quedan === 0 ? 'todo' : 'mes');
            setDatos(d => ({ ...d, pendientes: d.pendientes.filter(a => a.id !== agenda.id), resumen: respuesta || d.resumen }));
            if (respuesta) onResumen?.(respuesta);
            const enElMes = mesAhora ? ` en ${nombreDeMes(mesAhora)}` : '';
            setAviso(`${anuncio.keyword} quedó en la agenda de ${agenda.cliente}. `
                + (quedanMes ? `Te ${quedanMes === 1 ? 'queda' : 'quedan'} ${quedanMes}${enElMes}.`
                    : quedan ? `${tituloDeMes(mesAhora)} al día.` : 'Bandeja vacía.'));
            if (masTrabajo) {
                cargar();
            } else if (quedanMes === 0) {
                // El botón del mes que sigue, si hay: Enter y a seguir. Si no, el premio (para el lector).
                enfocarPremio.current = true;
            } else if (sigTarjeta) {
                // El foco salta al buscador de la que sigue: el mes se vacía sin tocar el mouse.
                requestAnimationFrame(() => tarjetas.current.get(sigTarjeta.id)?.focus());
            }
            return { ok: true };
        } catch (err) {
            return { error: err?.response?.data?.error || 'No se pudo asignar: probá de nuevo.' };
        }
    };

    // Al reclamar una agenda sin dueño pasa a ser suya: puede que entre a la bandeja.
    const alResolverSinDueno = (agendaId, resultado) => {
        setSinDueno(prev => prev.filter(a => a.id !== agendaId));
        if (resultado?.accion === 'mia') cargar();
    };

    // La barra: cuántas del mes ya tienen anuncio, sobre todas las del mes. Sin meses, la de antes
    // (las de hoy sobre las de hoy más las que quedan).
    const totalBarra = porMes ? infoMes.total : resumen.hoy + resumen.pendientes;
    const hechas = porMes ? Math.max(0, infoMes.total - infoMes.pendientes) : resumen.hoy;
    const avance = totalBarra ? Math.round((hechas / totalBarra) * 100) : 0;
    const nombre = porMes ? nombreDeMes(mes) : '';

    return (
        <div className="dc-shell dc-shell--embebido mis-agendas">
            <section className="ma-tira" aria-label="Tu avance">
                <div className="ma-avance">
                    <div className="ma-quedan">
                        <span className="k ma-k">
                            Te quedan
                            <Tip titulo="Te quedan" texto="Agendas de este mes que todavía no tienen la palabra clave del anuncio." />
                        </span>
                        <div className="ma-quedan-n">
                            {/* La clave nueva reinicia la animación: el número cae a su lugar cada vez que baja. */}
                            <b key={datos ? `${mes}-${delMes.length}` : 'cargando'} className={`num${datos ? ' ma-baja' : ''}`}>
                                {datos ? delMes.length : '—'}
                            </b>
                            <span className="mut">{porMes ? `sin palabra clave en ${nombre}` : 'sin palabra clave'}</span>
                        </div>
                    </div>
                    <div className="ma-barra-fila">
                        <div className="ma-barra" role="progressbar"
                            aria-label={porMes ? `Con palabra clave en ${nombre}` : 'Completadas hoy'}
                            aria-valuemin={0} aria-valuemax={totalBarra} aria-valuenow={hechas}>
                            <i style={{ width: `${avance}%` }} />
                        </div>
                        <span className="ma-barra-t num">
                            <b key={hechas} className={hechas ? 'ma-pop' : undefined}>{hechas}</b> de {totalBarra}{porMes ? ' del mes' : ' hoy'}
                            <Tip titulo={porMes ? 'Del mes' : 'Hoy'}
                                texto={porMes ? 'Agendas del mes que ya tienen su anuncio, sobre todas las del mes.'
                                    : 'Las que asignaste hoy, sobre las de hoy más las que quedan.'} />
                        </span>
                    </div>
                </div>
                <div className="ma-medidas">
                    <div className="medida">
                        <span className="k ma-k">Hoy<Tip titulo="Hoy" texto="Palabras clave que asignaste hoy, de cualquier mes." /></span>
                        <span className="mv" style={{ '--c': resumen.hoy ? 'var(--success)' : undefined }}>
                            <Check size={18} aria-hidden="true" />{resumen.hoy}<small>{resumen.hoy === 1 ? 'asignada' : 'asignadas'}</small>
                        </span>
                    </div>
                    <div className="medida">
                        <span className="k ma-k">Racha<Tip titulo="Racha" texto="Días seguidos que terminaste sin ninguna agenda pendiente." /></span>
                        <span className="mv" style={{ '--c': resumen.racha ? 'var(--warning)' : undefined }}>
                            <Flame size={18} aria-hidden="true" />{resumen.racha}<small>{resumen.racha === 1 ? 'día' : 'días'}</small>
                        </span>
                    </div>
                </div>
            </section>

            {datos && porMes && (
                <nav className="ma-meses" aria-label="Meses">
                    <h2 className="ma-mes-titulo">
                        {tituloDeMes(mes)} <span className="num">· {delMes.length}</span>
                    </h2>
                    {meses.length > 1 && (
                        <div className="ma-meses-chips">
                            {meses.map(m => {
                                const activo = m.mes === mes;
                                return (
                                    <button key={m.mes} type="button" aria-pressed={activo}
                                        aria-label={`${tituloDeMes(m.mes)}, ${m.pendientes ? `${m.pendientes} sin palabra clave` : 'completo'}`}
                                        className={`ma-mes${activo ? ' on' : ''}${m.pendientes ? '' : ' completo'}`}
                                        title={m.pendientes
                                            ? `${tituloDeMes(m.mes)}: ${m.pendientes} de ${m.total} sin palabra clave`
                                            : `${tituloDeMes(m.mes)}: completo`}
                                        onClick={() => irAlMes(m.mes)}>
                                        {/* La píldora del elegido se desliza de un mes al otro. */}
                                        {activo && (
                                            <motion.span className="ma-mes-pildora" layoutId="ma-mes-pildora" aria-hidden="true"
                                                transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />
                                        )}
                                        <span className="ma-mes-n">{mesCorto(m.mes)}</span>
                                        {m.pendientes
                                            ? <b className="num">{m.pendientes}</b>
                                            : <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </nav>
            )}

            <span className="sr" aria-live="polite">{aviso}</span>

            {!datos && !error && <EsqueletoFilas rotulo="Cargando tus agendas…" lineas={4} alto={92} />}

            {/* Una recarga que falla con la lista ya en pantalla no la tapa: el error es para cuando no
                hay nada que mostrar. */}
            {error && !datos && (
                <section className="ma-premio ma-premio--calmo" aria-label="No se pudo cargar">
                    <h2>No se pudieron cargar tus agendas</h2>
                    <button type="button" className="btn btn--linea" onClick={cargar}><RefreshCw size={16} />Reintentar</button>
                </section>
            )}

            {datos && delMes.length > 0 && (
                <>
                    <p className="ma-ayuda" aria-hidden="true">
                        <span className="tecla">↑</span><span className="tecla">↓</span> elegir
                        {' · '}<span className="tecla">Enter</span> asignar
                    </p>
                    {/* Una lista por mes: al cambiar de mes entra la nueva, sin que las tarjetas del
                        otro salgan una por una. */}
                    <motion.ul key={mes || 'todas'} className="ma-lista"
                        initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                        <AnimatePresence initial={false}>
                            {delMes.map((a, i) => (
                                <TarjetaAgenda key={a.id} agenda={a} orden={i} anuncios={datos.anuncios}
                                    sugerido={a.sugerido ? anuncioPorId.get(a.sugerido) : null}
                                    onAsignar={asignar}
                                    ref={(el) => { if (el) tarjetas.current.set(a.id, el); else tarjetas.current.delete(a.id); }} />
                            ))}
                        </AnimatePresence>
                    </motion.ul>
                </>
            )}

            {datos && delMes.length === 0 && (
                <div ref={premioRef} tabIndex={-1} className="ma-premio-foco">
                    <Premio ref={llamadoRef} festejo={festejo} hoy={resumen.hoy} racha={resumen.racha} mes={mes}
                        llamado={siguiente
                            ? { mes: siguiente.mes, pendientes: siguiente.pendientes, onIr: () => irAlMes(siguiente.mes, { enfocar: true }) }
                            : null}
                        onVerDatos={onVerDatos} />
                </div>
            )}

            <SetterUnclaimedAgendas agendas={sinDueno} onResuelta={alResolverSinDueno} />
        </div>
    );
};

export default MisAgendas;
