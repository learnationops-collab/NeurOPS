import React, { useEffect, useMemo, useState } from 'react';
import Legado from './Legado';
import { CalendarDays, Layers, LayoutGrid, List, Megaphone, Video } from 'lucide-react';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import WorkshopCardsView from '../components/WorkshopCardsView';
import WorkshopTableView from '../components/WorkshopTableView';
import WorkshopFunnelView from '../components/WorkshopFunnelView';
import WorkshopAnunciosView from '../components/WorkshopAnunciosView';
import WorkshopLandingView from '../components/WorkshopLandingView';
import WorkshopCompareModal from '../components/WorkshopCompareModal';

/**
 * Talleres: el historial de los talleres realizados con todo lo de cada uno — su embudo, los anuncios
 * de Meta que lo llenaron y la grabación de su landing. Antes eran cuatro pestañas sueltas
 * (Historial, Embudo, Anuncios, Landing grabación); desde el 16/10/2026 son una sola.
 *
 * El taller abierto se guarda por id y se lee de `realizados`: el polling de la página trae los
 * números frescos y el que estás mirando se actualiza solo.
 */

const VISTAS = [
    { key: 'lista', label: 'Talleres', Icono: Layers },
    { key: 'embudo', label: 'Embudo', Icono: CalendarDays },
    { key: 'anuncios', label: 'Anuncios', Icono: Megaphone },
    { key: 'grabacion', label: 'Grabación', Icono: Video },
];

const HistorialTab = ({ events, realizados, onEdit, onDelete, onRefresh, formatDate, formatCurrency }) => {
    const [vista, setVista] = useState('lista');
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [seleccionadoId, setSeleccionadoId] = useState(null);
    const [compareIds, setCompareIds] = useState([]);
    const [compareModalOpen, setCompareModalOpen] = useState(false);

    // Desglose vivo / grabación del taller abierto en el embudo
    const [desglose, setDesglose] = useState(null);
    const [ventana, setVentana] = useState(null);
    const [cargandoDesglose, setCargandoDesglose] = useState(false);
    const [resyncing, setResyncing] = useState(false);

    const seleccionado = useMemo(
        () => realizados.find((e) => e.id === seleccionadoId) || realizados[0] || null,
        [realizados, seleccionadoId]
    );

    const abrir = (evento, enVista) => {
        setSeleccionadoId(evento.id);
        setVista(enVista);
    };

    const toggleCompareId = (id) => {
        setCompareIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (prev.length >= 4) {
                toast.error('Podés comparar hasta 4 talleres a la vez');
                return prev;
            }
            return [...prev, id];
        });
    };

    // El desglose por embudo se pide solo al abrir el análisis de un taller: recorre agendas y ventas,
    // así que no vale la pena calcularlo para la lista. Mientras está abierto se refresca cada 30s
    // (silencioso) para que una agenda o venta nueva se vea sin salir y volver a entrar.
    useEffect(() => {
        if (vista !== 'embudo' || !seleccionado?.date) return undefined;
        let cancelado = false;
        const cargar = (silencioso) => {
            if (!silencioso) setCargandoDesglose(true);
            return api.get(`workshop/prefill?date=${seleccionado.date}`)
                .then((res) => {
                    if (cancelado) return;
                    setDesglose(res.data.desglose || null);
                    setVentana(res.data.ventana || null);
                })
                .catch((err) => {
                    if (!cancelado) console.error('Error cargando el desglose del workshop:', err);
                })
                .finally(() => { if (!cancelado && !silencioso) setCargandoDesglose(false); });
        };
        cargar(false);
        const interval = setInterval(() => cargar(true), 30000);
        return () => { cancelado = true; clearInterval(interval); };
    }, [vista, seleccionado?.date]);

    const handleResyncFunnel = async () => {
        if (!seleccionado || resyncing) return;
        try {
            setResyncing(true);
            const res = await api.get(`workshop/prefill?date=${seleccionado.date}`);
            const data = res.data;
            await api.put(`workshop/events/${seleccionado.id}`, {
                ...seleccionado,
                aplicaciones_form: data.aplicaciones_form,
                agendas_exitosas: data.agendas_exitosas,
                show_up_sales_call: data.show_up_sales_call,
                sales: data.sales,
                cash_collected: data.cash_collected,
                cash_ventas: data.cash_ventas,
                ventas_cobradas: data.ventas_cobradas,
            });
            toast.success('Datos del sistema actualizados correctamente');
            setDesglose(data.desglose || null);
            setVentana(data.ventana || null);
            onRefresh();
        } catch (err) {
            console.error('Error resincronizando embudo:', err);
            toast.error(err.response?.data?.error || 'Error al actualizar desde sistema');
        } finally {
            setResyncing(false);
        }
    };

    return (
        <Legado>
            <div className="section-tabs" role="tablist" aria-label="Vista de talleres" style={{ width: 'fit-content', marginBottom: 18 }}>
                {VISTAS.map(({ key, label, Icono }) => (
                    <button key={key} type="button" className={vista === key ? 'active' : ''} onClick={() => setVista(key)}
                        aria-current={vista === key ? 'page' : undefined}>
                        <Icono size={14} /> {label}{key === 'lista' ? ` (${realizados.length})` : ''}
                    </button>
                ))}
            </div>

            {vista === 'grabacion' ? (
                <WorkshopLandingView events={events} onConfigSaved={() => onRefresh(true)} formatDate={formatDate} />
            ) : realizados.length === 0 ? (
                <section className="empty-state">
                    <div><CalendarDays size={26} /></div>
                    <p className="eyebrow">Empezá por acá</p>
                    <h2>No hay workshops registrados</h2>
                    <p>Registrá el primero para empezar a medir el embudo.</p>
                </section>
            ) : vista === 'lista' ? (
                <>
                    <div className="section-tabs" role="tablist" aria-label="Modo de vista" style={{ width: 'fit-content', marginBottom: 18 }}>
                        <button type="button" className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>
                            <LayoutGrid size={14} /> Tarjetas
                        </button>
                        <button type="button" className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
                            <List size={14} /> Tabla comparativa
                        </button>
                    </div>
                    {viewMode === 'cards' ? (
                        <WorkshopCardsView
                            events={realizados}
                            onSelectFunnel={(e) => abrir(e, 'embudo')}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            formatDate={formatDate}
                            formatCurrency={formatCurrency}
                            selectedIds={compareIds}
                            onToggleSelect={toggleCompareId}
                        />
                    ) : (
                        <WorkshopTableView
                            events={realizados}
                            onSelectFunnel={(e) => abrir(e, 'embudo')}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            formatDate={formatDate}
                            formatCurrency={formatCurrency}
                            selectedIds={compareIds}
                            onToggleSelect={toggleCompareId}
                        />
                    )}
                </>
            ) : vista === 'embudo' ? (
                <WorkshopFunnelView
                    events={realizados}
                    selectedEvent={seleccionado}
                    onSelectEvent={(e) => setSeleccionadoId(e.id)}
                    onResync={handleResyncFunnel}
                    resyncing={resyncing}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    desglose={desglose}
                    ventana={ventana}
                    cargandoDesglose={cargandoDesglose}
                    onVerAnuncios={() => setVista('anuncios')}
                />
            ) : (
                seleccionado && (
                    <WorkshopAnunciosView
                        key={seleccionado.id}
                        evento={seleccionado}
                        eventos={realizados}
                        onSelectEvent={(e) => setSeleccionadoId(e.id)}
                        formatDate={formatDate}
                        formatCurrency={formatCurrency}
                    />
                )
            )}

            {/* Barra flotante de comparación (hasta 4 talleres) */}
            {compareIds.length > 0 && vista === 'lista' && (
                <div className="compare-bar">
                    <span>{compareIds.length} seleccionados</span>
                    <button type="button" className="confirm" onClick={() => setCompareModalOpen(true)} disabled={compareIds.length < 2}>
                        Comparar
                    </button>
                    <button type="button" className="clear" onClick={() => setCompareIds([])}>
                        Limpiar
                    </button>
                </div>
            )}

            {compareModalOpen && (
                <WorkshopCompareModal
                    events={events.filter((e) => compareIds.includes(e.id))}
                    onClose={() => setCompareModalOpen(false)}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                />
            )}
        </Legado>
    );
};

export default HistorialTab;
