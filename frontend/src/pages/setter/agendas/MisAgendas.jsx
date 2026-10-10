import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Flame, RefreshCw } from 'lucide-react';
import api from '../../../services/api';
import { EsqueletoFilas } from '../../comercial/components/Shared';
import TarjetaAgenda from './TarjetaAgenda';
import Premio from './Premio';
import SetterUnclaimedAgendas from './SetterUnclaimedAgendas';
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
 * El trabajo es de teclado: escribir el anuncio, Enter, y el foco pasa al buscador de la agenda que
 * sigue. Cada asignación se nota en el momento: la tarjeta se va, "Te quedan" baja y la barra de
 * hoy se llena. Con la última, el festejo.
 *
 * Debajo, lo que antes estaba en la pestaña Historial y no tiene otro lugar: las agendas de setting
 * sin dueño para reclamar. Los links de agendamiento están en el menú de la sesión del dock.
 *
 * `onResumen` le avisa al espacio cuántas quedan (la marca del dock); `onVerDatos` lleva a "Mis
 * datos" desde el festejo.
 */
const dinero = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;

const MisAgendas = ({ onResumen, onVerDatos }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [festejo, setFestejo] = useState(false);
    const [aviso, setAviso] = useState('');
    const [sinDueno, setSinDueno] = useState([]);
    const [comision, setComision] = useState(null);
    const tarjetas = useRef(new Map());
    const premioRef = useRef(null);
    // La lista del último render: una respuesta que llega tarde (asignó dos seguidas) tiene que ver
    // la lista de ahora, no la de cuando se mandó.
    const listaRef = useRef([]);
    listaRef.current = datos?.pendientes || [];
    // Cada carga lleva su número y solo vale la última. Asignar también cuenta como una: una carga
    // que salió antes (la segunda del montaje, en desarrollo) puede volver DESPUÉS con la bandeja de
    // antes de asignar, o vaciarla antes de que llegue la respuesta y mostrar "Todo al día" en vez
    // del festejo.
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
        // La comisión del mes vivía arriba del mazo (pedido del 10/09/2026: "que puedan ver cuánto
        // van ganando"): sigue a la vista, al lado de la racha.
        api.get('/setter/commission').then(r => setComision(r.data || null)).catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const anuncioPorId = useMemo(() => new Map((datos?.anuncios || []).map(a => [a.id, a])), [datos?.anuncios]);

    const asignar = async (agenda, anuncio, instagram) => {
        pedido.current += 1;
        try {
            const res = await api.post('/setter/palabras-clave', {
                appointment_id: agenda.id, ad_id: anuncio.id, ...(instagram !== undefined ? { instagram } : {}),
            });
            const resumen = res.data?.resumen;
            const lista = listaRef.current;
            const i = lista.findIndex(a => a.id === agenda.id);
            const siguiente = lista[i + 1] || lista[i - 1] || null;
            const quedan = lista.filter(a => a.id !== agenda.id).length;
            // Entraron otras mientras trabajaba: no hay festejo, hay más trabajo.
            const masTrabajo = quedan === 0 && resumen && resumen.pendientes > 0;
            // El festejo se prende ANTES de vaciar la lista: si no, por un instante se veía "Todo
            // al día", que es lo de quien entra y ya la encuentra vacía.
            if (quedan === 0 && !masTrabajo) setFestejo(true);
            setDatos(d => ({ ...d, pendientes: d.pendientes.filter(a => a.id !== agenda.id), resumen: resumen || d.resumen }));
            if (resumen) onResumen?.(resumen);
            setAviso(`${anuncio.keyword} quedó en la agenda de ${agenda.cliente}. `
                + (quedan ? `Te ${quedan === 1 ? 'queda' : 'quedan'} ${quedan}.` : 'Bandeja vacía.'));
            if (masTrabajo) {
                cargar();
            } else if (quedan === 0) {
                requestAnimationFrame(() => premioRef.current?.focus());
            } else if (siguiente) {
                // El foco salta al buscador de la que sigue: la bandeja se vacía sin tocar el mouse.
                requestAnimationFrame(() => tarjetas.current.get(siguiente.id)?.focus());
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

    const resumen = datos?.resumen || { pendientes: 0, hoy: 0, racha: 0 };
    const pendientes = datos?.pendientes || [];
    const total = resumen.hoy + resumen.pendientes;
    const avance = total ? Math.round((resumen.hoy / total) * 100) : 0;

    return (
        <div className="dc-shell dc-shell--embebido mis-agendas">
            <section className="ma-tira" aria-label="Tu avance">
                <div className="ma-avance">
                    <div className="ma-quedan">
                        <span className="k">Te quedan</span>
                        <div className="ma-quedan-n">
                            {/* La clave nueva reinicia la animación: el número cae a su lugar cada vez que baja. */}
                            <b key={datos ? resumen.pendientes : 'cargando'} className={`num${datos ? ' ma-baja' : ''}`}>
                                {datos ? resumen.pendientes : '—'}
                            </b>
                            <span className="mut">{resumen.pendientes === 1 ? 'agenda sin palabra clave' : 'agendas sin palabra clave'}</span>
                        </div>
                    </div>
                    <div className="ma-barra-fila">
                        <div className="ma-barra" role="progressbar" aria-label="Completadas hoy"
                            aria-valuemin={0} aria-valuemax={total} aria-valuenow={resumen.hoy}>
                            <i style={{ width: `${avance}%` }} />
                        </div>
                        <span className="ma-barra-t num">
                            <b key={resumen.hoy} className={resumen.hoy ? 'ma-pop' : undefined}>{resumen.hoy}</b> de {total} hoy
                        </span>
                    </div>
                </div>
                <div className="ma-medidas">
                    <div className="medida">
                        <span className="k">Racha</span>
                        <span className="mv" style={{ '--c': resumen.racha ? 'var(--warning)' : undefined }}>
                            <Flame size={18} aria-hidden="true" />{resumen.racha}<small>{resumen.racha === 1 ? 'día' : 'días'}</small>
                        </span>
                    </div>
                    <div className="medida">
                        <span className="k">Comisión del mes</span>
                        <span className="mv" style={{ '--c': comision ? 'var(--success)' : undefined }}>
                            {comision ? dinero(comision.commission) : '—'}
                        </span>
                        {comision && (
                            <small className="ma-medida-pie">{Math.round(comision.rate * 100)}% de {dinero(comision.cash_neto)} netos</small>
                        )}
                    </div>
                </div>
            </section>

            <span className="sr" aria-live="polite">{aviso}</span>

            {!datos && !error && <EsqueletoFilas rotulo="Cargando tus agendas…" lineas={4} alto={92} />}

            {/* Una recarga que falla con la lista ya en pantalla no la tapa: el error es para cuando no
                hay nada que mostrar. */}
            {error && !datos && (
                <section className="ma-premio ma-premio--calmo" aria-label="No se pudo cargar">
                    <h2>No se pudieron cargar tus agendas</h2>
                    <p>Revisá la conexión y probá de nuevo.</p>
                    <button type="button" className="btn btn--linea" onClick={cargar}><RefreshCw size={16} />Reintentar</button>
                </section>
            )}

            {datos && pendientes.length > 0 && (
                <>
                    <p className="ma-ayuda" aria-hidden="true">
                        Escribí el anuncio, elegí con <span className="tecla">↑</span><span className="tecla">↓</span>
                        {' '}y asigná con <span className="tecla">Enter</span>: el foco pasa a la que sigue.
                    </p>
                    <ul className="ma-lista">
                        <AnimatePresence initial={false}>
                            {pendientes.map((a, i) => (
                                <TarjetaAgenda key={a.id} agenda={a} orden={i} anuncios={datos.anuncios}
                                    sugerido={a.sugerido ? anuncioPorId.get(a.sugerido) : null}
                                    onAsignar={asignar}
                                    ref={(el) => { if (el) tarjetas.current.set(a.id, el); else tarjetas.current.delete(a.id); }} />
                            ))}
                        </AnimatePresence>
                    </ul>
                </>
            )}

            {datos && pendientes.length === 0 && (
                <div ref={premioRef} tabIndex={-1} className="ma-premio-foco">
                    <Premio festejo={festejo} hoy={resumen.hoy} racha={resumen.racha} onVerDatos={onVerDatos} />
                </div>
            )}

            <SetterUnclaimedAgendas agendas={sinDueno} onResuelta={alResolverSinDueno} />
        </div>
    );
};

export default MisAgendas;
