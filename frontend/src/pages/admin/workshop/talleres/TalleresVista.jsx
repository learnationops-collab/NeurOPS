import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, HardDrive, LayoutGrid, List, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { Tip } from '../../../comercial/components/Shared';
import useModoVista from '../../../../components/listas/useModoVista';
import WorkshopCompareModal from '../components/WorkshopCompareModal';
import WorkshopLandingView from '../components/WorkshopLandingView';
import TarjetaTaller from './TarjetaTaller';
import TablaTalleres from './TablaTalleres';
import DetalleTaller from './DetalleTaller';
import CargarGrabaciones from './CargarGrabaciones';
import Hoja from './Hoja';
import useAhora from './useAhora';
import './talleres.css';

/**
 * Talleres: todos los talleres realizados en una sola vista, en tarjetas o en tabla (se recuerda).
 *
 *  - Cada tarjeta tiene su conmutador para ver adentro, en resumen, su embudo, sus anuncios de Meta
 *    y su grabación (con el interruptor de la landing). «Ver completo» abre el detalle.
 *  - La tabla es la lista estándar (`ListaConfigurable`): columnas elegibles, filtro completo y
 *    orden. La fila abre el detalle.
 *  - El detalle (embudo con desglose vivo, tabla de anuncios, config de la grabación) es una hoja,
 *    no una pestaña. El embudo general de la landing de la grabación, otra hoja.
 *  - Comparar: hasta cuatro, desde la tarjeta o desde la casilla de la fila.
 *
 * Lo abierto se sigue por id y se lee de `realizados`: el polling de la página trae los números
 * frescos y el taller que estás mirando se actualiza solo. Si desaparece (se eliminó), se cierra.
 */

const MAX_COMPARAR = 4;

const TalleresVista = ({ events, realizados, onEdit, onRefresh, formatDate }) => {
    const { modo, setModo } = useModoVista('workshop_talleres_modo', 'tarjetas');
    const [abierto, setAbierto] = useState(null); // { id, vista }
    const [landingAbierta, setLandingAbierta] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [comparar, setComparar] = useState([]);
    const [comparando, setComparando] = useState(false);
    const ahora = useAhora(30000);
    const quieto = useReducedMotion();

    const delAbierto = abierto && realizados.find((e) => e.id === abierto.id);
    useEffect(() => { if (abierto && !delAbierto) setAbierto(null); }, [abierto, delAbierto]);

    // Un taller eliminado sale también de la comparación.
    useEffect(() => {
        setComparar((ids) => {
            const vigentes = ids.filter((id) => realizados.some((e) => e.id === id));
            return vigentes.length === ids.length ? ids : vigentes;
        });
    }, [realizados]);

    const alternarComparar = useCallback((id) => {
        setComparar((ids) => {
            if (ids.includes(id)) return ids.filter((x) => x !== id);
            if (ids.length >= MAX_COMPARAR) {
                toast.error(`Podés comparar hasta ${MAX_COMPARAR} talleres a la vez`);
                return ids;
            }
            return [...ids, id];
        });
    }, []);

    const abrir = useCallback((evento, vista = 'embudo') => setAbierto({ id: evento.id, vista }), []);
    const refrescar = useCallback(() => onRefresh(true), [onRefresh]);

    // Eliminar con InlineConfirm: el pedido sale cuando se agota la ventana de deshacer.
    const eliminar = useCallback(async (evento) => {
        try {
            await api.delete(`workshop/events/${evento.id}`);
            toast.success('Taller eliminado');
            onRefresh(true);
        } catch (err) {
            console.error('Error eliminando el taller:', err);
            toast.error('No se pudo eliminar el taller');
        }
    }, [onRefresh]);

    const editar = useCallback((evento) => { setAbierto(null); onEdit(evento); }, [onEdit]);

    const elegidos = useMemo(() => events.filter((e) => comparar.includes(e.id)), [events, comparar]);

    const controles = (
        <>
            <div className="seg" role="group" aria-label="Forma de ver los talleres">
                <button type="button" aria-pressed={modo === 'tarjetas'} title="Ver como tarjetas" aria-label="Ver como tarjetas"
                    onClick={() => setModo('tarjetas')}>
                    <LayoutGrid size={14} aria-hidden="true" />
                </button>
                <button type="button" aria-pressed={modo === 'lista'} title="Ver como tabla" aria-label="Ver como tabla"
                    onClick={() => setModo('lista')}>
                    <List size={14} aria-hidden="true" />
                </button>
            </div>
            <button type="button" className="pastilla pastilla--sm" onClick={() => setLandingAbierta(true)}>
                <PlayCircle aria-hidden="true" /> Landing de la grabación
            </button>
            <button type="button" className="pastilla pastilla--sm" onClick={() => setCargando(true)}>
                <HardDrive aria-hidden="true" /> Cargar grabaciones
            </button>
        </>
    );

    return (
        <div className="vista wt-talleres">
            {realizados.length === 0 ? (
                <section className="panel wt-vacio">
                    <span className="vacio-icono" aria-hidden="true"><CalendarDays /></span>
                    <h2 className="t-h3">Todavía no hay talleres realizados</h2>
                    <p className="t-body mut">Registrá el primero con «Registrar taller», arriba a la derecha.</p>
                    <div className="fila">{controles}</div>
                </section>
            ) : modo === 'lista' ? (
                <TablaTalleres talleres={realizados} formatDate={formatDate} elegidos={comparar}
                    onComparar={alternarComparar} onAbrir={abrir} extra={controles} />
            ) : (
                <>
                    <div className="fila barra-tabla wt-barra">
                        {controles}
                        <span className="barra-cuenta">
                            <span className="t-cap mut40 num">{realizados.length} {realizados.length === 1 ? 'taller' : 'talleres'}</span>
                            <Tip titulo="Qué estás mirando"
                                texto="Para filtrar y elegir columnas, pasá a la tabla." />
                        </span>
                    </div>
                    <div className="wt-tarjetas">
                        {realizados.map((e, i) => (
                            <TarjetaTaller key={e.id} evento={e} i={i} ahora={ahora} formatDate={formatDate}
                                elegido={comparar.includes(e.id)} onComparar={alternarComparar} onAbrir={abrir}
                                onEditar={editar} onEliminar={eliminar} onGuardado={refrescar} />
                        ))}
                    </div>
                </>
            )}

            {comparar.length > 0 && (
                <motion.div className="wt-comparar-barra" role="region" aria-label="Comparación"
                    initial={quieto ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={quieto ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}>
                    <span className="t-cap num"><b>{comparar.length}</b> de {MAX_COMPARAR} para comparar</span>
                    <button type="button" className="btn btn--cta btn--sm" disabled={comparar.length < 2}
                        onClick={() => setComparando(true)} title={comparar.length < 2 ? 'Elegí al menos dos' : undefined}>
                        Comparar
                    </button>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => setComparar([])}>Limpiar</button>
                </motion.div>
            )}

            {delAbierto && (
                <DetalleTaller evento={delAbierto} talleres={realizados} vista={abierto.vista}
                    onVista={(vista) => setAbierto((a) => ({ ...a, vista }))}
                    onMover={(id) => setAbierto((a) => ({ ...a, id }))}
                    onCerrar={() => setAbierto(null)} onEditar={editar}
                    onEliminar={(e) => { setAbierto(null); return eliminar(e); }}
                    onRefresh={onRefresh} formatDate={formatDate} />
            )}

            {landingAbierta && (
                <Hoja titulo="Landing de la grabación" onCerrar={() => setLandingAbierta(false)}
                    cabeza={<><p className="t-eyebrow">Todos los talleres</p><h2 className="t-h2">Landing de la grabación</h2></>}>
                    <WorkshopLandingView />
                </Hoja>
            )}

            {cargando && <CargarGrabaciones onCerrar={() => setCargando(false)} onGuardado={refrescar} />}

            {comparando && elegidos.length >= 2 && (
                <WorkshopCompareModal events={elegidos} onClose={() => setComparando(false)} formatDate={formatDate} />
            )}
        </div>
    );
};

export default TalleresVista;
