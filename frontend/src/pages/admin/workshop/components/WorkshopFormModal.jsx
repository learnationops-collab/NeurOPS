import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2, ArrowLeft, ArrowRight, X, Check } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

const STEP_META = [
    { n: 1, title: 'Tráfico & ads', copy: 'Evento e inversión' },
    { n: 2, title: 'Embudo del webinar', copy: 'Leads y retención' },
    { n: 3, title: 'Validación del sistema', copy: 'Agendas, ventas y cash' },
];

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
            if (!formData.date || !formData.name) return;
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(3);
            if (formData.date && prefilledDate !== formData.date) {
                onPrefill(formData.date);
            }
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const field = (key) => ({
        value: formData[key],
        onChange: (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value })),
    });

    return (
        <div className="modal-overlay">
            <button type="button" className="modal-backdrop" aria-label="Cerrar ventana de registro" onClick={onClose} />
            <div className="action-modal wide" role="dialog" aria-modal="true" aria-label={isEditMode ? 'Editar taller' : 'Registrar taller'}>
                <header>
                    <div>
                        <p className="eyebrow">{isEditMode ? 'Editar taller' : 'Registro guiado'}</p>
                        <h2>{STEP_META[currentStep - 1].title}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
                </header>

                <div className="modal-body">
                    <div className="wizard-steps" style={{ display: 'flex', gap: 8, marginBottom: 26 }}>
                        {STEP_META.map((s) => (
                            <button
                                type="button"
                                key={s.n}
                                style={{ flex: 1 }}
                                className={currentStep === s.n ? 'active' : currentStep > s.n ? 'complete' : ''}
                                onClick={() => s.n < currentStep && setCurrentStep(s.n)}
                            >
                                <span>{currentStep > s.n ? <Check size={14} /> : s.n}</span>
                                <div><strong>{s.title}</strong><small>{s.copy}</small></div>
                            </button>
                        ))}
                    </div>

                    <form onSubmit={onSubmit}>
                        {currentStep === 1 && (
                            <div className="form-grid">
                                <label className="form-field">
                                    <span>Fecha del evento</span>
                                    <span className="field-control"><input type="date" disabled={isEditMode} required {...field('date')} /></span>
                                </label>
                                <label className="form-field">
                                    <span>Nombre del workshop</span>
                                    <span className="field-control"><input type="text" placeholder="Ej: Webinar IA Ventas" required {...field('name')} /></span>
                                </label>
                                <label className="form-field wide">
                                    <span>Inversión ads (USD)</span>
                                    <span className="field-control money"><b>$</b><input type="number" step="any" {...field('inversion')} /></span>
                                </label>
                                <label className="form-field">
                                    <span>CPM (ads)</span>
                                    <span className="field-control"><input type="number" step="any" {...field('cpm')} /></span>
                                </label>
                                <label className="form-field">
                                    <span>CPC único</span>
                                    <span className="field-control"><input type="number" step="any" {...field('cpc')} /></span>
                                </label>
                                <label className="form-field wide">
                                    <span>Clics únicos</span>
                                    <span className="field-control"><input type="number" {...field('clics')} /></span>
                                </label>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="form-grid">
                                <label className="form-field">
                                    <span>Leads totales</span>
                                    <span className="field-control"><input type="number" {...field('leads')} /></span>
                                </label>
                                <label className="form-field">
                                    <span>Leads en WhatsApp</span>
                                    <span className="field-control"><input type="number" {...field('whatsapp_leads')} /></span>
                                </label>
                                <label className="form-field wide">
                                    <span>Show up en webinar</span>
                                    <span className="field-control"><input type="number" {...field('show_up')} /></span>
                                </label>
                                <label className="form-field">
                                    <span>Leads en pitch</span>
                                    <span className="field-control"><input type="number" {...field('pitch_leads')} /></span>
                                </label>
                                <label className="form-field">
                                    <span>Leads final pitch</span>
                                    <span className="field-control"><input type="number" {...field('pitch_final_leads')} /></span>
                                </label>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <>
                                <div className="section-heading" style={{ marginBottom: 16 }}>
                                    <div><p className="eyebrow">Confirmá los datos de NeurOPS</p></div>
                                    <button type="button" className="icon-button" onClick={() => onPrefill(formData.date)} title="Sincronizar datos" aria-label="Sincronizar datos">
                                        <RefreshCw size={16} className={loadingPrefill ? 'animate-spin' : ''} />
                                    </button>
                                </div>

                                <div style={{ position: 'relative' }}>
                                    {loadingPrefill && (
                                        <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(2,6,23,.75)', backdropFilter: 'blur(4px)', borderRadius: 16 }}>
                                            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--pink)' }} />
                                            <p className="eyebrow" style={{ margin: 0 }}>Sincronizando base de datos…</p>
                                        </div>
                                    )}

                                    <div className="form-grid">
                                        <label className="form-field">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Aplicaciones form <InfoTooltip label="Aplicaciones form" text="Cuánta gente completó el formulario de calificación para pedir una llamada. Suma la clase en vivo y la grabación de la landing." /></span>
                                            <span className="field-control"><input type="number" {...field('aplicaciones_form')} /></span>
                                        </label>
                                        <label className="form-field">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Agendas exitosas <InfoTooltip label="Agendas exitosas" text="Llamadas de venta que quedaron agendadas. Suma la clase en vivo y la grabación." /></span>
                                            <span className="field-control"><input type="number" {...field('agendas_exitosas')} /></span>
                                        </label>
                                        <label className="form-field">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Show up sales call <InfoTooltip label="Show up sales call" text="De esas agendas, a cuántas la persona realmente se presentó." /></span>
                                            <span className="field-control"><input type="number" {...field('show_up_sales_call')} /></span>
                                        </label>
                                        <label className="form-field">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Ventas (compradores) <InfoTooltip label="Ventas (compradores)" text="Personas distintas que compraron, no cantidad de pagos: si alguien paga en dos partes cuenta una sola vez. Solo Seña, Split Pay y pago Completo." /></span>
                                            <span className="field-control"><input type="number" {...field('sales')} /></span>
                                        </label>
                                        <label className="form-field wide">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Cash collected (USD) <InfoTooltip label="Cash collected (USD)" text="Plata efectivamente cobrada de esas ventas. No incluye cuotas posteriores, renovaciones ni upsells." /></span>
                                            <span className="field-control money"><b style={{ color: 'var(--success)' }}>$</b><input type="number" step="any" {...field('cash_collected')} /></span>
                                        </label>
                                    </div>

                                    {desglose && (
                                        <div style={{ marginTop: 14, padding: 16, border: '1px solid var(--border)', borderRadius: 16, background: 'rgba(0,0,0,.2)' }}>
                                            <p className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                De dónde salieron estos números
                                                <InfoTooltip label="De dónde salieron" text="Un workshop tiene dos puertas de entrada: la clase en vivo del día y la grabación que queda publicada después. Los campos de arriba ya suman las dos; acá se ve cuánto puso cada una." />
                                            </p>
                                            {ventana && (
                                                <p className="secondary-copy" style={{ fontSize: 10, margin: '6px 0 12px' }}>
                                                    Agendas contadas del {ventana.desde} al {ventana.hasta}
                                                    {ventana.abierta ? ' (hasta hoy: se cierra al registrar el próximo taller)' : ` (hasta el día anterior al taller del ${ventana.siguiente})`}
                                                </p>
                                            )}
                                            <div className="source-grid" style={{ marginTop: 12 }}>
                                                {[
                                                    { t: 'Clase en vivo', d: desglose.vivo },
                                                    { t: 'Grabación', d: desglose.landing },
                                                ].map(({ t, d }) => (
                                                    <article key={t}>
                                                        <div className="source-title"><span>{t}</span></div>
                                                        <dl style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                                            <div><dt>Aplicaciones</dt><dd>{d?.aplicaciones_form ?? 0}</dd></div>
                                                            <div><dt>Agendas</dt><dd>{d?.agendas ?? 0}</dd></div>
                                                            <div><dt>Asistieron</dt><dd>{d?.show_up ?? 0}</dd></div>
                                                            <div><dt>Compradores</dt><dd>{d?.sales ?? 0}</dd></div>
                                                        </dl>
                                                    </article>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {agendaBreakdown && (
                                        <div style={{ marginTop: 14, padding: 16, border: '1px solid var(--border)', borderRadius: 16, background: 'rgba(0,0,0,.2)' }}>
                                            <p className="eyebrow">Citas y asistencias de closer</p>
                                            <dl className="event-stats" style={{ marginTop: 10 }}>
                                                <div><dt>Asistió</dt><dd>{agendaBreakdown['Show Up']}</dd></div>
                                                <div><dt>No asistió</dt><dd>{agendaBreakdown['No Show']}</dd></div>
                                                <div><dt>Cancelada</dt><dd>{agendaBreakdown['Cancelada']}</dd></div>
                                                <div><dt>Reagendada</dt><dd>{agendaBreakdown['Reagendada']}</dd></div>
                                                <div><dt>Pendiente</dt><dd>{agendaBreakdown['Pendiente']}</dd></div>
                                                <div><dt>Otros</dt><dd>{agendaBreakdown['Otros']}</dd></div>
                                            </dl>
                                        </div>
                                    )}
                                </div>

                                <div className="wizard-preview" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                    <div><span>Costo por lead</span><strong>{formatCurrency(liveCalculations.cpl)}</strong></div>
                                    <div><span>Costo por agenda</span><strong>{formatCurrency(liveCalculations.cost_ag)}</strong></div>
                                    <div><span>ROAS estimado</span><strong className={liveCalculations.roas >= 3 ? 'positive' : ''}>{liveCalculations.roas.toFixed(2)}x</strong></div>
                                </div>
                            </>
                        )}

                        <div className="wizard-footer">
                            <div>
                                {currentStep > 1 ? (
                                    <button type="button" className="secondary-action" onClick={handlePrevStep}><ArrowLeft size={15} /> Atrás</button>
                                ) : (
                                    <button type="button" className="secondary-action" onClick={onClose}>Cancelar</button>
                                )}
                            </div>
                            <div>
                                {currentStep < 3 ? (
                                    <button type="button" className="primary-action" onClick={handleNextStep}>Siguiente <ArrowRight size={16} /></button>
                                ) : (
                                    <button type="submit" className="primary-action form-submit" disabled={!guardadoHabilitado}>
                                        {isEditMode ? 'Guardar cambios' : 'Registrar evento'} <Check size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default WorkshopFormModal;
