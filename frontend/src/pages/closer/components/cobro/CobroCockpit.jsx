import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CalendarDays, DollarSign, MessageSquare, TrendingUp, Check } from 'lucide-react';
import { AvisoSeguimientoWhatsApp, MissingFieldsHint } from '../FormHints';
import ArmarPlanCuotas from './ArmarPlanCuotas';

// Cada acción que el backend puede nombrar como principal tiene acá su pantalla. El backend
// dice qué le toca al cliente, el frontend decide con qué se resuelve: así agregar una pantalla
// no obliga a tocar las dos capas.
const PASOS = {
    armar_plan: { label: 'Armar el plan', icon: CalendarDays },
    registrar_cobro: { label: 'Registrar un pago', icon: DollarSign },
    programar_cobro: { label: 'Reportar el contacto', icon: MessageSquare },
    registrar_renovacion: { label: 'Renovación o upsell', icon: TrendingUp }
};

const TONOS = {
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    primary: 'bg-violet-500/10 border-violet-500/30 text-violet-300',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
};

const moneda = (n) => (typeof n === 'number' ? `$${Math.round(n).toLocaleString('en-US')}` : 'Sin datos');

// Red de seguridad para payloads que todavía no traen la etapa calculada (leads sintéticos sin
// id real, o una pestaña abierta antes del despliegue): la pantalla tiene que abrir igual.
const etapaDeRespaldo = (lead) => {
    const deuda = typeof lead?.deuda === 'number' ? lead.deuda : 0;
    if (deuda > 0.01) {
        return {
            clave: 'sin_plan',
            titulo: `Debe ${moneda(deuda)}`,
            subtitulo: 'Cobrale o dejá agendado el próximo intento.',
            tono: 'warning',
            accion_principal: 'programar_cobro',
            acciones: ['programar_cobro', 'armar_plan', 'registrar_cobro']
        };
    }
    return {
        clave: 'al_dia',
        titulo: 'Al día · no debe nada',
        subtitulo: 'El seguimiento es cómo le está yendo en el programa.',
        tono: 'success',
        accion_principal: 'programar_cobro',
        acciones: ['programar_cobro', 'registrar_renovacion']
    };
};

const Opcion = ({ onClick, tipo, label, sub, seleccionada }) => (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} data-t={tipo} className={`opt ${seleccionada ? 'sel' : ''}`}>
        {seleccionada && <Check size={12} strokeWidth={3} />}
        {label}
        {sub && <small>{sub}</small>}
    </motion.button>
);

/**
 * Pantalla de un cliente que ya compró. La base es siempre la misma —quién es, en qué momento
 * del cobro está y su plan de cuotas— y lo que cambia adentro es el paso que le toca, que sale
 * de `etapa_cobro` (lo calcula el backend en lead_cobro_service).
 *
 * Antes esta pantalla era una sola: el mismo formulario de "¿qué pasó con el cobro?" tanto para
 * el que debe y no tiene cronograma como para el que ya terminó de pagar hace meses. El que
 * debía sin plan no tenía desde dónde armárselo y el que estaba al día igual recibía preguntas
 * de cobranza.
 */
const CobroCockpit = ({
    lead,
    cuotas = [],
    cargandoCuotas = false,
    onCuotasChanged,
    sessionForm,
    setSessionForm,
    procesando = false,
    onReportarPago,
    onGuardar,
    menciones = null
}) => {
    const etapa = lead?.etapa_cobro || etapaDeRespaldo(lead);
    const [paso, setPaso] = useState(() => (PASOS[etapa.accion_principal] ? etapa.accion_principal : 'programar_cobro'));

    const pasosDisponibles = useMemo(
        () => (etapa.acciones || []).filter(a => PASOS[a]),
        [etapa.acciones]
    );

    const cuotasPendientes = cuotas.filter(c => c.estado !== 'pagado');

    // --- Paso: reportar el contacto ---
    // Con deuda es una cobranza; sin deuda el contacto es de acompañamiento, y preguntarle
    // "¿pagó?" o darle "no va a pagar" a alguien que no debe nada no significa nada.
    const enCobro = (etapa.deuda || 0) > 0.01;
    const isPago = sessionForm.result === 'pago';
    const necesitaFecha = sessionForm.result === 'no_resp' || sessionForm.result === 'contesto';
    const largoNotas = (sessionForm.notes || '').trim().length;
    const faltantes = [];
    if (!sessionForm.result) faltantes.push(enCobro ? 'Elegí qué pasó con el cobro' : 'Elegí qué pasó con el contacto');
    if (largoNotas < 10) faltantes.push(`Contá qué le dijiste y qué respondió (mínimo 10 caracteres, llevás ${largoNotas})`);
    if (necesitaFecha && !sessionForm.fecha_seguimiento_cobro_next) {
        faltantes.push(enCobro ? 'Elegí la fecha del próximo intento de cobro' : 'Elegí cuándo volvés a escribirle');
    }
    const puedeCompletar = faltantes.length === 0;

    const elegirResultado = (result, extra = {}) =>
        setSessionForm(prev => ({ ...prev, result, sig_action: null, cierre_motivo: null, ...extra }));

    const renderPaso = () => {
        if (paso === 'armar_plan') {
            return (
                <ArmarPlanCuotas
                    lead={lead}
                    onCreado={(nuevas) => { onCuotasChanged?.(nuevas); setPaso('programar_cobro'); }}
                    onCancelar={() => setPaso('programar_cobro')}
                />
            );
        }

        if (paso === 'registrar_cobro') {
            return (
                <div className="space-y-3">
                    {cuotasPendientes.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 text-center space-y-2">
                            <p className="text-[11px] font-bold text-slate-300">
                                No hay ninguna cuota pendiente en su cronograma.
                            </p>
                            <p className="text-[11px] font-medium text-slate-500">
                                Si igual te pagó, registralo como pago suelto y después ajustá el plan.
                            </p>
                            <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => onReportarPago?.(null)}
                                className="h-9 px-4 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wide rounded-xl transition-all cursor-pointer"
                            >
                                Registrar un pago suelto
                            </motion.button>
                        </div>
                    ) : (
                        <>
                            <p className="text-[11px] font-medium text-slate-400">
                                Elegí qué cuota te pagó. Se abre el registro de cobro con el monto ya cargado.
                            </p>
                            <div className="space-y-2">
                                {cuotasPendientes.map(c => (
                                    <motion.button
                                        key={c.id}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => onReportarPago?.(c)}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                                            c.estado === 'vencido'
                                                ? 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/60'
                                                : 'bg-slate-950/40 border-slate-800 hover:border-violet-500/50'
                                        }`}
                                    >
                                        <span className="text-xs font-black text-white">Cuota {c.numero_cuota}</span>
                                        <span className="text-xs font-bold text-slate-300">{moneda(c.monto)}</span>
                                        <span className="text-[11px] font-bold text-slate-400">{c.fecha_vencimiento}</span>
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border ${
                                            c.estado === 'vencido'
                                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                        }`}>
                                            {c.estado}
                                        </span>
                                    </motion.button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            );
        }

        if (paso === 'registrar_renovacion') {
            return (
                <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                            Está al día y con el programa andando
                        </p>
                        <p className="text-[11px] font-medium text-emerald-200/80">
                            Es la conversación de renovar lo que tiene o subirlo de programa. Si cierra, se declara como
                            una venta de tipo Renovación o Upsell.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onReportarPago?.(null, { renovacion: true })}
                            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wide rounded-xl transition-all cursor-pointer"
                        >
                            Cerró una renovación
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setPaso('programar_cobro')}
                            className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wide rounded-xl transition-all cursor-pointer"
                        >
                            Todavía no · reportar el contacto
                        </motion.button>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="q req space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-300">
                        {enCobro ? '¿Qué pasó con el cobro?' : '¿Cómo viene con el programa?'}
                    </h4>
                    <div className={`grid gap-2 ${enCobro ? 'grid-cols-4' : 'grid-cols-3'}`}>
                        <Opcion onClick={() => elegirResultado('no_resp')} tipo="no" label="No respondió" seleccionada={sessionForm.result === 'no_resp'} />
                        <Opcion onClick={() => elegirResultado('contesto')} tipo="info" label="Estamos conversando" seleccionada={sessionForm.result === 'contesto'} />
                        {enCobro ? (
                            <>
                                <Opcion onClick={() => elegirResultado('pago')} tipo="ok" label="Pagó" seleccionada={sessionForm.result === 'pago'} />
                                {/* "No va a pagar": pedido del usuario (loom, 27/ago/2026) para poder sacar de la
                                    cola de cobros a un cliente que ya avisó que no va a pagar, en vez de seguir
                                    programando intentos indefinidamente. Reusa el mecanismo de "Cerrar
                                    Seguimiento" del paso normal de seguimientos (sig_action 'close'). */}
                                <Opcion
                                    onClick={() => elegirResultado('no_paga', { sig_action: 'close', cierre_motivo: 'No va a pagar' })}
                                    tipo="bad" label="No va a pagar" sub="Sale de la cola"
                                    seleccionada={sessionForm.result === 'no_paga'}
                                />
                            </>
                        ) : (
                            <Opcion onClick={() => setPaso('registrar_renovacion')} tipo="ok" label="Quiere renovar" sub="Renovación o upsell" />
                        )}
                    </div>
                    {isPago && (
                        <p className="text-xs text-slate-400 font-medium">
                            Al continuar se abre el registro de cobro con el historial de pagos y el plan de cuotas ya cargados.
                        </p>
                    )}
                </div>

                {necesitaFecha && (
                    <div className="space-y-1.5 text-left">
                        <label className="text-xs text-slate-300 font-bold uppercase tracking-wide block">
                            {enCobro ? '¿Cuándo es el siguiente seguimiento de cobro?' : '¿Cuándo volvés a escribirle?'} <span className="rq text-pink-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={sessionForm.fecha_seguimiento_cobro_next}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, fecha_seguimiento_cobro_next: e.target.value }))}
                            className="w-full max-w-[220px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                        />
                        <p className="text-xs text-slate-400 font-medium">
                            Puede ser hoy mismo si quedaste en volver a escribirle más tarde.
                        </p>
                        {sessionForm.fecha_seguimiento_cobro_next && (
                            <AvisoSeguimientoWhatsApp
                                enabled={sessionForm.followup_reminder_enabled}
                                time={sessionForm.followup_reminder_time}
                                fecha={sessionForm.fecha_seguimiento_cobro_next}
                                onChange={({ enabled, time }) => setSessionForm(prev => ({
                                    ...prev, followup_reminder_enabled: enabled, followup_reminder_time: time
                                }))}
                            />
                        )}
                    </div>
                )}

                <div className="space-y-1.5 text-left">
                    <label className="text-xs text-slate-300 font-bold uppercase tracking-wide block">
                        Qué sucedió exactamente (Requerido)
                    </label>
                    <textarea
                        rows={3}
                        value={sessionForm.notes}
                        onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder={enCobro
                            ? 'Le recordé la cuota de este mes. Dijo que cobra el viernes y transfiere a primera hora del lunes...'
                            : 'Le pregunté cómo va con el programa. Va por el módulo 3 y quiere sumar la mentoría...'}
                        className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                    />
                    {menciones}
                </div>

                {faltantes.length > 0 && <MissingFieldsHint items={faltantes} />}

                <div className="flex justify-end items-center pt-2 border-t border-slate-800">
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onGuardar}
                        disabled={!puedeCompletar || procesando}
                        className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide rounded-xl transition-all cursor-pointer"
                    >
                        {procesando ? <Loader2 size={12} className="animate-spin" /> : (isPago ? 'Continuar al registro de cobro →' : (enCobro ? 'Completar Cobro' : 'Completar seguimiento'))}
                    </motion.button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* La base fija: dónde está parado este cliente, lo mismo se entre desde la cola de
                cobro, desde el buscador o desde su historial. */}
            <div className={`p-3 rounded-2xl border text-center ${TONOS[etapa.tono] || TONOS.primary}`}>
                <p className="text-[11px] font-black uppercase tracking-wider">{etapa.titulo}</p>
                <p className="text-[11px] font-medium opacity-80 mt-0.5">{etapa.subtitulo}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-950/20 border border-slate-800 p-4 rounded-2xl text-sm font-bold text-slate-300">
                <div>
                    <span className="text-slate-400 text-[11px] font-semibold block">Programa</span>
                    <b>{lead.programa_nombre || 'Sin datos'}</b>
                </div>
                <div>
                    <span className="text-slate-400 text-[11px] font-semibold block">Deuda pendiente</span>
                    <b className={typeof lead.deuda === 'number' && lead.deuda > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        {moneda(lead.deuda)}
                    </b>
                </div>
            </div>

            {pasosDisponibles.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {pasosDisponibles.map(clave => {
                        const Icono = PASOS[clave].icon;
                        const activo = paso === clave;
                        return (
                            <motion.button
                                key={clave}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setPaso(clave)}
                                className={`h-8 px-3 rounded-xl border text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
                                    activo
                                        ? 'bg-violet-600 border-violet-500 text-white'
                                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                }`}
                            >
                                <Icono size={12} />
                                {PASOS[clave].label}
                            </motion.button>
                        );
                    })}
                </div>
            )}

            {cargandoCuotas ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-violet-500" size={18} /></div>
            ) : cuotas.length > 0 && paso !== 'armar_plan' && paso !== 'registrar_cobro' && (
                <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-300">Plan de cuotas</h4>
                    <div className="rounded-xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-xs">
                            <tbody>
                                {cuotas.map(c => (
                                    <tr key={c.id} className="border-t border-slate-800 first:border-t-0">
                                        <td className="px-3 py-2 font-bold text-white">Cuota {c.numero_cuota}</td>
                                        <td className="px-3 py-2 font-bold text-slate-300">{moneda(c.monto)}</td>
                                        <td className="px-3 py-2 font-bold text-slate-300">{c.fecha_vencimiento}</td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase border ${
                                                c.estado === 'pagado' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                                c.estado === 'vencido' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                                                'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                            }`}>
                                                {c.estado}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {c.estado !== 'pagado' && (
                                                <button
                                                    onClick={() => onReportarPago?.(c)}
                                                    className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold uppercase rounded-lg transition-all cursor-pointer"
                                                >
                                                    Reportar pago
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <motion.div
                key={paso}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
            >
                {renderPaso()}
            </motion.div>
        </div>
    );
};

export default CobroCockpit;
