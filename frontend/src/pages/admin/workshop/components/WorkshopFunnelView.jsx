import React, { useMemo } from 'react';
import { Loader2, Zap } from 'lucide-react';

const WorkshopFunnelView = ({
    events,
    selectedEvent,
    onSelectEvent,
    onResync,
    resyncing,
    formatDate,
    formatCurrency
}) => {
    const activeFunnelData = useMemo(() => {
        if (!selectedEvent) return [];
        const e = selectedEvent;
        const leads = e.leads || 0;
        
        const pct = (val) => leads > 0 ? ((val / leads) * 100).toFixed(1) + '%' : '0%';
        
        return [
            { label: 'Leads Captados', value: leads, rate: '100%', detail: 'Base del embudo — prospectos registrados' },
            { label: 'Leads en WhatsApp', value: e.whatsapp_leads, rate: pct(e.whatsapp_leads), sub: 'Entrada WA', detail: 'Leads que ingresaron al grupo de WhatsApp' },
            { label: 'Asistencia Webinar (Show Up)', value: e.show_up, rate: pct(e.show_up), sub: 'Show up Webinar', detail: 'Conectados en vivo al webinar' },
            { label: 'Leads en Pitch', value: e.pitch_leads, rate: pct(e.pitch_leads), sub: 'Retención Clase', detail: 'Permanecieron hasta la presentación del pitch' },
            { label: 'Final de Pitch', value: e.pitch_final_leads, rate: pct(e.pitch_final_leads), sub: 'Retención Pitch', detail: 'Presenciaron la oferta completa' },
            { label: 'Aplicaciones Form (Calendly)', value: e.aplicaciones_form, rate: pct(e.aplicaciones_form), sub: 'Tasa Aplicación', detail: 'Completaron formulario de calificación' },
            { label: 'Agendas Exitosas', value: e.agendas_exitosas, rate: pct(e.agendas_exitosas), sub: 'Aplicación a Cita', detail: 'Agendaron sesión uno a uno con closer' },
            { label: 'Asistencia Cita (Show Up)', value: e.show_up_sales_call, rate: pct(e.show_up_sales_call), sub: 'Show Up en Cita', detail: 'Asistieron a la llamada de ventas' },
            { label: 'Ventas Cerradas (Compradores)', value: e.sales, rate: pct(e.sales), sub: 'Tasa de Cierre Global', detail: 'Leads compradores únicos (Seña, Split Pay o Completo).' }
        ];
    }, [selectedEvent]);

    const profit = selectedEvent ? selectedEvent.cash_collected - selectedEvent.inversion : 0;
    const cac = selectedEvent && selectedEvent.sales > 0 ? selectedEvent.inversion / selectedEvent.sales : 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Selector de Evento */}
            <div className="lg:col-span-1 bg-slate-900/30 border border-slate-900 p-6 rounded-3xl space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Seleccionar Evento</h3>
                <div className="space-y-2 max-h-[550px] overflow-y-auto pr-2">
                    {events.map((e) => (
                        <button
                            key={e.id}
                            onClick={() => onSelectEvent(e)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center ${
                                selectedEvent?.id === e.id 
                                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white shadow-lg' 
                                    : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-900/40'
                            }`}
                        >
                            <div>
                                <p className="text-xs font-black italic leading-none mb-1">{formatDate(e.date)}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{e.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-white">{e.roas.toFixed(2)}x ROAS</p>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{formatCurrency(e.inversion)} inv.</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Visual Embudo Grafico */}
            <div className="lg:col-span-2 bg-slate-900/20 border border-slate-900 p-8 rounded-[2.5rem] space-y-8">
                {/* Header Embudo */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-6">
                    <div>
                        <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{selectedEvent?.name}</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formatDate(selectedEvent?.date)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onResync}
                            disabled={resyncing}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            title="Resincronizar aplicaciones, agendas y ventas desde base de datos"
                        >
                            {resyncing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                            {resyncing ? 'Sincronizando...' : 'Resync Sistema'}
                        </button>
                        <div className="text-right">
                            <span className="text-emerald-400 font-black text-2xl italic tracking-tighter">
                                {selectedEvent && `${selectedEvent.roas.toFixed(2)}x ROAS`}
                            </span>
                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Retorno Ads</p>
                        </div>
                    </div>
                </div>

                {/* CEO Overview Bar */}
                {selectedEvent && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800/40 text-center">
                        <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Inversión</p>
                            <p className="text-sm font-black text-slate-200">{formatCurrency(selectedEvent.inversion)}</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Recaudado</p>
                            <p className="text-sm font-black text-emerald-400">{formatCurrency(selectedEvent.cash_collected)}</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Profit Neto</p>
                            <p className={`text-sm font-black ${profit >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>{formatCurrency(profit)}</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase">CAC Real</p>
                            <p className="text-sm font-black text-purple-400">{formatCurrency(cac)}</p>
                        </div>
                    </div>
                )}

                {/* Pasos del embudo */}
                <div className="space-y-5">
                    {activeFunnelData.map((step, idx) => {
                        let conversionFromPrev = '';
                        if (idx > 0 && activeFunnelData[idx - 1].value > 0) {
                            const pct = (step.value / activeFunnelData[idx - 1].value) * 100;
                            conversionFromPrev = `${pct.toFixed(1)}% de retención`;
                        }

                        return (
                            <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between items-end text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-black text-slate-400 flex items-center justify-center italic">
                                            {idx + 1}
                                        </span>
                                        <span className="font-black text-white uppercase tracking-wider">{step.label}</span>
                                        {conversionFromPrev && (
                                            <span className="text-[8px] text-indigo-400/80 font-bold uppercase tracking-widest">
                                                ({conversionFromPrev})
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-white text-sm tracking-tighter">{step.value.toLocaleString()}</span>
                                        {step.sub && (
                                            <span className="ml-2 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[8px] text-indigo-400 font-black uppercase tracking-widest">
                                                {step.rate}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Barra visual */}
                                <div className="w-full h-3 bg-slate-950 border border-slate-900 rounded-full overflow-hidden relative">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-400 rounded-full transition-all duration-700 origin-left"
                                        style={{ width: `${selectedEvent?.leads ? (step.value / selectedEvent.leads) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider pl-7">{step.detail}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WorkshopFunnelView;
