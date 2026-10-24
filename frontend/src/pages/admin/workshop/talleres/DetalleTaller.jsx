import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { Segmented } from '../../../comercial/components/Shared';
import InlineConfirm from '../../../../components/ui/InlineConfirm';
import WorkshopFunnelView from '../components/WorkshopFunnelView';
import WorkshopAnunciosView from '../components/WorkshopAnunciosView';
import WorkshopReplayConfigPanel from '../components/WorkshopReplayConfigPanel';
import AgendasDelTaller from '../agendas/AgendasDelTaller';
import Hoja from './Hoja';
import { VISTAS_TALLER } from './TarjetaTaller';
import { roasRotulo, roasTono, veces } from './formato';

/**
 * El detalle completo de un taller, en una hoja: su embudo con el desglose vivo (vivo vs.
 * grabación), la tabla de sus anuncios de Meta y la config de su grabación. Las flechas pasan al
 * taller anterior o siguiente sin cerrar.
 *
 * El taller llega fresco del polling de la página (se sigue por id). El desglose por fuente se pide
 * solo mientras se mira el embudo, y se refresca cada 30 s en silencio.
 */

const useDesglose = (evento, activo) => {
    const [estado, setEstado] = useState({ desglose: null, ventana: null, cargando: false });
    const fecha = evento?.date;

    useEffect(() => {
        if (!activo || !fecha) return undefined;
        let cancelado = false;
        const cargar = (silencioso) => {
            if (!silencioso) setEstado({ desglose: null, ventana: null, cargando: true });
            return api.get(`workshop/prefill?date=${fecha}`)
                .then((res) => {
                    if (!cancelado) setEstado({ desglose: res.data.desglose || null, ventana: res.data.ventana || null, cargando: false });
                })
                .catch((err) => {
                    if (cancelado) return;
                    console.error('Error cargando el desglose del workshop:', err);
                    setEstado((s) => ({ ...s, cargando: false }));
                });
        };
        cargar(false);
        const t = setInterval(() => cargar(true), 30000);
        return () => { cancelado = true; clearInterval(t); };
    }, [activo, fecha]);

    return [estado, setEstado];
};

const DetalleTaller = ({
    evento, talleres, vista, onVista, onMover, onCerrar, onEditar, onEliminar, onRefresh, formatDate,
}) => {
    const quieto = useReducedMotion();
    const [{ desglose, ventana, cargando }, setDesglose] = useDesglose(evento, vista === 'embudo');
    const [resyncing, setResyncing] = useState(false);

    const i = talleres.findIndex((t) => t.id === evento.id);
    const anterior = i > 0 ? talleres[i - 1] : null;   // más nuevo (la lista va de nuevo a viejo)
    const siguiente = i >= 0 && i < talleres.length - 1 ? talleres[i + 1] : null;

    const resync = async () => {
        if (resyncing) return;
        try {
            setResyncing(true);
            const { data } = await api.get(`workshop/prefill?date=${evento.date}`);
            await api.put(`workshop/events/${evento.id}`, {
                ...evento,
                aplicaciones_form: data.aplicaciones_form,
                agendas_exitosas: data.agendas_exitosas,
                show_up_sales_call: data.show_up_sales_call,
                sales: data.sales,
                cash_collected: data.cash_collected,
                cash_ventas: data.cash_ventas,
                ventas_cobradas: data.ventas_cobradas,
            });
            toast.success('Datos del sistema actualizados');
            setDesglose({ desglose: data.desglose || null, ventana: data.ventana || null, cargando: false });
            onRefresh(true);
        } catch (err) {
            console.error('Error resincronizando embudo:', err);
            toast.error(err.response?.data?.error || 'Error al actualizar desde el sistema');
        } finally {
            setResyncing(false);
        }
    };

    const tono = roasTono(evento.roas);
    const cabeza = (
        <div className="wt-detalle-cab">
            <div className="wt-detalle-id">
                <p className="t-eyebrow num">{formatDate(evento.date)}</p>
                <h2 className="t-h2 wt-detalle-nom" title={evento.name}>{evento.name}</h2>
                <span className="chip" style={{ '--c': `var(--${tono})` }}>
                    ROAS {veces(evento.roas)} · {roasRotulo(evento.roas)}
                </span>
                <span className="t-sm mut num">
                    <AgendasDelTaller evento={evento} formatDate={formatDate}>{evento.agendas_exitosas ?? 0} agendas</AgendasDelTaller>
                </span>
            </div>
            <div className="wt-detalle-barra">
                <Segmented opciones={VISTAS_TALLER} valor={vista} onChange={onVista} ariaLabel="Detalle del taller" />
                <div className="wt-detalle-acciones">
                    <button type="button" className="ibtn ibtn--sm" disabled={!anterior} onClick={() => onMover(anterior.id)}
                        aria-label="Taller más nuevo" title={anterior ? `${formatDate(anterior.date)} · ${anterior.name}` : undefined}>
                        <ChevronLeft aria-hidden="true" />
                    </button>
                    <button type="button" className="ibtn ibtn--sm" disabled={!siguiente} onClick={() => onMover(siguiente.id)}
                        aria-label="Taller anterior" title={siguiente ? `${formatDate(siguiente.date)} · ${siguiente.name}` : undefined}>
                        <ChevronRight aria-hidden="true" />
                    </button>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => onEditar(evento)}>
                        <Edit2 aria-hidden="true" /> Editar
                    </button>
                    <InlineConfirm compacto alto={34} corner={999} label="Eliminar taller" doneLabel="Eliminado"
                        title={`Eliminar ${evento.name}`} onConfirm={() => onEliminar(evento)} />
                </div>
            </div>
        </div>
    );

    return (
        <Hoja titulo={`${evento.name}, ${formatDate(evento.date)}`} cabeza={cabeza} onCerrar={onCerrar}>
            <motion.div key={`${evento.id}-${vista}`}
                initial={quieto ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={quieto ? { duration: 0 } : { duration: 0.24, ease: 'easeOut' }}>
                {vista === 'embudo' && (
                    <WorkshopFunnelView evento={evento} desglose={desglose} ventana={ventana} cargandoDesglose={cargando}
                        onResync={resync} resyncing={resyncing} />
                )}
                {vista === 'anuncios' && <WorkshopAnunciosView key={evento.id} evento={evento} />}
                {vista === 'grabacion' && <WorkshopReplayConfigPanel evento={evento} onSaved={() => onRefresh(true)} />}
            </motion.div>
        </Hoja>
    );
};

export default DetalleTaller;
