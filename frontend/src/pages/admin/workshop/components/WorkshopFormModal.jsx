import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

const WorkshopFormModal = ({
    isEditMode,
    currentStep,
    setCurrentStep,
    formData,
    setFormData,
    agendaBreakdown,
    desglose,
    ventana,
    loadingPrefill,
    prefilledDate,
    onPrefill,
    onClose,
    onSubmit,
    formatCurrency
}) => {
    // "Siguiente" (paso 2) y "Guardar Cambios" (paso 3) caen en la misma posición del
    // pie del modal, así que un doble clic sobre Siguiente guardaba el evento sin querer:
    // el segundo clic aterrizaba sobre el botón de guardar recién renderizado. El botón de
    // guardar arranca inhabilitado un instante al llegar al paso 3, lo justo para que ese
    // segundo clic no encuentre nada que pulsar.
    const [guardadoHabilitado, setGuardadoHabilitado] = useState(false);

    useEffect(() => {
        if (currentStep !== 3) {
            setGuardadoHabilitado(false);
            return;
        }
        const t = setTimeout(() => setGuardadoHabilitado(true), 600);
        return () => clearTimeout(t);
    }, [currentStep]);

    const liveCalculations = useMemo(() => {
        const inv = parseFloat(formData.inversion) || 0;
        const leads = parseInt(formData.leads) || 0;
        const ags = parseInt(formData.agendas_exitosas) || 0;
        const cash = parseFloat(formData.cash_collected) || 0;

        const cpl = leads > 0 ? inv / leads : 0;
        const cost_ag = ags > 0 ? inv / ags : 0;
        const roas = inv > 0 ? cash / inv : 0;
        const profit = cash - inv;

        return { cpl, cost_ag, roas, profit };
    }, [formData]);

    const handleNextStep = () => {
        if (currentStep === 1) {
            if (!formData.date || !formData.name) {
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(3);
            if (formData.date && prefilledDate !== formData.date) {
                onPrefill(formData.date);
            }
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-slate-950 border border-slate-800 w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl relative border-indigo-500/20">
                {/* Header Pasos */}
                <div className="px-8 py-5 bg-slate-900/40 border-b border-slate-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${currentStep >= 1 ? 'bg-indigo-600 text-white border-indigo-500 border' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>1</div>
                        <div className="w-6 h-0.5 bg-slate-800" />
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${currentStep >= 2 ? 'bg-indigo-600 text-white border-indigo-500 border' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>2</div>
                        <div className="w-6 h-0.5 bg-slate-800" />
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${currentStep >= 3 ? 'bg-indigo-600 text-white border-indigo-500 border' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>3</div>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Paso {currentStep} de 3</p>
                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-wider italic">
                            {currentStep === 1 ? 'Tráfico & Anuncios' : currentStep === 2 ? 'Embudo Webinar' : 'Validación NeurOPS'}
                        </p>
                    </div>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-6">
                    {/* PASO 1: Tráfico y Anuncios */}
                    {currentStep === 1 && (
                        <div className="space-y-5 animate-fadeIn">
                            <div>
                                <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">Tráfico & Ads</h3>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Ingresa los datos generales del evento y la inversión publicitaria</p>
                            </div>

                            <div className="space-y-4 bg-slate-900/10 border border-slate-900 p-5 rounded-2xl">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fecha del Evento</label>
                                        <input
                                            type="date"
                                            disabled={isEditMode}
                                            value={formData.date}
                                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Nombre del Workshop</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Webinar IA Ventas"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none uppercase font-bold"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Inversión Ads (USD)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-slate-500 text-xs">$</span>
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.inversion}
                                            onChange={(e) => setFormData(prev => ({ ...prev, inversion: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 p-3 text-xs text-white focus:border-indigo-500 outline-none font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">CPM (Ads)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.cpm}
                                            onChange={(e) => setFormData(prev => ({ ...prev, cpm: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">CPC Único</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.cpc}
                                            onChange={(e) => setFormData(prev => ({ ...prev, cpc: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Clics Únicos</label>
                                    <input
                                        type="number"
                                        value={formData.clics}
                                        onChange={(e) => setFormData(prev => ({ ...prev, clics: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: Asistencia & Retención */}
                    {currentStep === 2 && (
                        <div className="space-y-5 animate-fadeIn">
                            <div>
                                <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">Asistencia & Retención</h3>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Ingresa los leads captados y las métricas de retención durante el webinar</p>
                            </div>

                            <div className="space-y-4 bg-slate-900/10 border border-slate-900 p-5 rounded-2xl">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads Totales</label>
                                        <input
                                            type="number"
                                            value={formData.leads}
                                            onChange={(e) => setFormData(prev => ({ ...prev, leads: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads en WhatsApp</label>
                                        <input
                                            type="number"
                                            value={formData.whatsapp_leads}
                                            onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_leads: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Show Up en Webinar</label>
                                    <input
                                        type="number"
                                        value={formData.show_up}
                                        onChange={(e) => setFormData(prev => ({ ...prev, show_up: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads en Pitch</label>
                                        <input
                                            type="number"
                                            value={formData.pitch_leads}
                                            onChange={(e) => setFormData(prev => ({ ...prev, pitch_leads: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads Final Pitch</label>
                                        <input
                                            type="number"
                                            value={formData.pitch_final_leads}
                                            onChange={(e) => setFormData(prev => ({ ...prev, pitch_final_leads: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 3: Validación del Sistema */}
                    {currentStep === 3 && (
                        <div className="space-y-5 animate-fadeIn">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">Validación del Sistema</h3>
                                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Confirma los datos obtenidos automáticamente de NeurOPS</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onPrefill(formData.date)}
                                    className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                                    title="Sincronizar datos"
                                >
                                    <RefreshCw size={14} className={loadingPrefill ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            <div className="space-y-4 bg-slate-900/10 border border-slate-900 p-5 rounded-2xl relative">
                                {loadingPrefill && (
                                    <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-20 space-y-2">
                                        <Loader2 size={20} className="animate-spin text-indigo-500" />
                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Sincronizando base de datos...</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">Aplicaciones Form <InfoTooltip label="Aplicaciones Form" text="Cuánta gente completó el formulario de calificación para pedir una llamada. Suma la clase en vivo y la grabación de la landing." /></label>
                                        <input
                                            type="number"
                                            value={formData.aplicaciones_form}
                                            onChange={(e) => setFormData(prev => ({ ...prev, aplicaciones_form: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">Agendas Exitosas <InfoTooltip label="Agendas Exitosas" text="Llamadas de venta que quedaron agendadas. Suma la clase en vivo y la grabación." /></label>
                                        <input
                                            type="number"
                                            value={formData.agendas_exitosas}
                                            onChange={(e) => setFormData(prev => ({ ...prev, agendas_exitosas: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">Show up Sales Call <InfoTooltip label="Show up Sales Call" text="De esas agendas, a cuántas la persona realmente se presentó." /></label>
                                        <input
                                            type="number"
                                            value={formData.show_up_sales_call}
                                            onChange={(e) => setFormData(prev => ({ ...prev, show_up_sales_call: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">Ventas por Lead (Compradores) <InfoTooltip label="Ventas por Lead (Compradores)" text="Personas distintas que compraron, no cantidad de pagos: si alguien paga en dos partes cuenta una sola vez. Solo Seña, Split Pay y pago Completo." /></label>
                                        <input
                                            type="number"
                                            value={formData.sales}
                                            onChange={(e) => setFormData(prev => ({ ...prev, sales: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">Cash Collected (USD) <InfoTooltip label="Cash Collected (USD)" text="Plata efectivamente cobrada de esas ventas. No incluye cuotas posteriores, renovaciones ni upsells." /></label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-emerald-500 text-xs">$</span>
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.cash_collected}
                                            onChange={(e) => setFormData(prev => ({ ...prev, cash_collected: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 p-3 text-xs text-emerald-400 border-emerald-500/20 bg-emerald-500/5 focus:border-emerald-500 outline-none font-bold"
                                        />
                                    </div>
                                </div>

                                {desglose && (
                                    <div className="mt-3 bg-slate-950/60 p-3 rounded-xl border border-slate-900 space-y-2">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none flex items-center gap-1.5">
                                            De dónde salieron estos números
                                            <InfoTooltip
                                                label="De dónde salieron"
                                                text="Un workshop tiene dos puertas de entrada: la clase en vivo del día y la grabación que queda publicada después. Los campos de arriba ya suman las dos; acá se ve cuánto puso cada una."
                                            />
                                        </p>
                                        {ventana && (
                                            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">
                                                Grabación contada del {ventana.landing_desde} al {ventana.landing_hasta}
                                                {ventana.landing_recortada ? ' (recortada: hay otro workshop antes)' : ''}
                                            </p>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 text-[8px] font-bold">
                                            {[
                                                { t: 'Clase en vivo', d: desglose.vivo, c: 'text-indigo-300' },
                                                { t: 'Grabación', d: desglose.landing, c: 'text-emerald-300' }
                                            ].map(({ t, d, c }) => (
                                                <div key={t} className="bg-slate-900/60 p-2 rounded space-y-0.5">
                                                    <p className={`uppercase tracking-widest ${c}`}>{t}</p>
                                                    <p className="text-slate-400">Aplicaciones: {d?.aplicaciones_form ?? 0}</p>
                                                    <p className="text-slate-400">Agendas: {d?.agendas ?? 0}</p>
                                                    <p className="text-slate-400">Asistieron: {d?.show_up ?? 0}</p>
                                                    <p className="text-slate-400">Compradores: {d?.sales ?? 0}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {agendaBreakdown && (
                                    <div className="mt-3 bg-slate-950/60 p-3 rounded-xl border border-slate-900 space-y-1.5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Citas y Asistencias de Closer</p>
                                        <div className="grid grid-cols-3 gap-1 text-[8px] font-bold text-slate-400">
                                            <div className="bg-slate-900/60 p-1.5 rounded">Asistió: {agendaBreakdown["Show Up"]}</div>
                                            <div className="bg-slate-900/60 p-1.5 rounded">No Asistió: {agendaBreakdown["No Show"]}</div>
                                            <div className="bg-slate-900/60 p-1.5 rounded">Cancelada: {agendaBreakdown["Cancelada"]}</div>
                                            <div className="bg-slate-900/60 p-1.5 rounded">Reagendada: {agendaBreakdown["Reagendada"]}</div>
                                            <div className="bg-slate-900/60 p-1.5 rounded">Pendiente: {agendaBreakdown["Pendiente"]}</div>
                                            <div className="bg-slate-900/60 p-1.5 rounded">Otros: {agendaBreakdown["Otros"]}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Previsualización Ratios */}
                            <div className="bg-slate-900/5 border border-slate-900 p-4 rounded-xl space-y-2.5">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">Previsualización de Métricas</p>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                                        <p className="text-[8px] text-slate-500 font-bold uppercase">CPL</p>
                                        <p className="font-black text-indigo-400">{formatCurrency(liveCalculations.cpl)}</p>
                                    </div>
                                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                                        <p className="text-[8px] text-slate-500 font-bold uppercase">Costo Agenda</p>
                                        <p className="font-black text-slate-300">{formatCurrency(liveCalculations.cost_ag)}</p>
                                    </div>
                                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                                        <p className="text-[8px] text-slate-500 font-bold uppercase">ROAS Estimado</p>
                                        <p className={`font-black ${liveCalculations.roas >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {liveCalculations.roas.toFixed(2)}x
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Botones de navegación modal */}
                    <div className="flex justify-between items-center border-t border-slate-900 pt-6 mt-4">
                        {currentStep > 1 ? (
                            <button
                                type="button"
                                onClick={handlePrevStep}
                                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest border border-slate-800 flex items-center gap-2"
                            >
                                <ArrowLeft size={12} />
                                Atrás
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest border border-slate-800"
                            >
                                Cancelar
                            </button>
                        )}

                        {currentStep < 3 ? (
                            <button
                                type="button"
                                onClick={handleNextStep}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/20 border border-indigo-500/30"
                            >
                                Siguiente
                                <ArrowRight size={12} />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!guardadoHabilitado}
                                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isEditMode ? 'Guardar Cambios' : 'Registrar Evento'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WorkshopFormModal;
