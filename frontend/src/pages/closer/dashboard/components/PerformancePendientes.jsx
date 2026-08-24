import React from 'react';
import { ArrowRight, PhoneCall, CalendarCheck, MessageSquare, CheckCircle2 } from 'lucide-react';
import Card from '../../../../components/ui/Card';

/* Trabajo que el closer todavía no completó, a hoy.
 *
 * A propósito NO respeta el filtro de fechas del dashboard (ver CloserPendingService): una agenda
 * sin reportar de hace tres semanas sigue siendo trabajo pendiente aunque el período filtrado sean
 * los últimos 7 días. Los números son los mismos que los contadores de las pestañas del mazo, para
 * que el dashboard no diga algo distinto del lugar donde efectivamente se trabaja.
 *
 * `step` es la pestaña del mazo a la que lleva cada tarjeta. Cuando el dashboard se abre suelto
 * (vista de admin) no hay adónde navegar y las tarjetas quedan solo informativas.
 */

const TONES = {
    rose: { card: 'border-rose-500/30 bg-rose-500/[0.07]', num: 'text-rose-400', icon: 'text-rose-400' },
    amber: { card: 'border-amber-500/30 bg-amber-500/[0.07]', num: 'text-amber-400', icon: 'text-amber-400' },
    sky: { card: 'border-sky-500/30 bg-sky-500/[0.07]', num: 'text-sky-400', icon: 'text-sky-400' },
    calm: { card: 'border-base bg-surface', num: 'text-muted', icon: 'text-muted' }
};

const PendingTile = ({ icon: Icon, title, count, tone, detail, hint, actionLabel, onGo }) => {
    const t = TONES[count > 0 ? tone : 'calm'];
    return (
        <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${t.card}`}>
            <div className="flex items-start gap-3">
                <Icon size={18} className={`shrink-0 mt-0.5 ${t.icon}`} />
                <div className="min-w-0 flex-1">
                    <b className="text-[12.5px] leading-tight block">{title}</b>
                    <span className={`text-3xl font-black tracking-tighter leading-none block mt-1.5 ${t.num}`}>
                        {count}
                    </span>
                </div>
            </div>

            {detail.length > 0 && (
                <ul className="space-y-1">
                    {detail.map(d => (
                        <li key={d.label} className="flex items-baseline justify-between gap-3 text-[11px]">
                            <span className="text-muted">{d.label}</span>
                            <b className={d.strong && d.value > 0 ? 'text-rose-400' : 'text-base'}>{d.value}</b>
                        </li>
                    ))}
                </ul>
            )}

            {hint && <p className="text-[10.5px] text-muted leading-snug">{hint}</p>}

            {count > 0 && onGo && (
                <button
                    onClick={onGo}
                    className="mt-auto px-3 py-1.5 rounded-xl bg-surface border border-base text-[10px] font-black uppercase tracking-wider hover:border-primary/50 transition-colors cursor-pointer flex items-center gap-1.5 w-fit"
                >
                    {actionLabel} <ArrowRight size={12} />
                </button>
            )}
        </div>
    );
};

const PerformancePendientes = ({ pendientes, onNavigate }) => {
    if (!pendientes) return null;

    const sr = pendientes.agendas_sin_reportar || {};
    const pc = pendientes.por_confirmar || {};
    const sg = pendientes.seguimientos || {};
    const paraCargar = (pendientes.reportes_sin_enviar?.count || 0) + (pendientes.cupos_sin_declarar?.count || 0);

    const go = (step) => (onNavigate ? () => onNavigate('inbox', { step }) : null);

    if (!pendientes.total) {
        return (
            <Card variant="surface" padding="p-5" className="border-emerald-500/25 bg-emerald-500/[0.05]">
                <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    <div>
                        <b className="text-[12.5px] block">No queda nada pendiente en el mazo</b>
                        <p className="text-[11px] text-muted leading-snug">
                            Todas las llamadas están reportadas, no hay agendas sin confirmar y los seguimientos están al día.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card variant="surface" padding="p-6">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-xs font-black uppercase tracking-widest text-base">Lo que te falta completar</h3>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-surface-hover text-muted">
                    {pendientes.total}
                </span>
            </div>
            <p className="text-[11px] text-muted mb-5 leading-snug">
                Trabajo pendiente <b className="text-base">a hoy</b>, sin importar el período filtrado arriba: una agenda
                sin reportar de hace tres semanas se sigue debiendo aunque estés mirando los últimos 7 días. Son los
                mismos números que ves en las pestañas del mazo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <PendingTile
                    icon={PhoneCall}
                    title="Agendas sin reportar"
                    count={sr.count || 0}
                    tone="rose"
                    detail={[
                        { label: 'De días anteriores', value: sr.atrasadas || 0, strong: true },
                        { label: 'De hoy', value: sr.de_hoy || 0 }
                    ]}
                    hint={sr.dias_mas_vieja ? `La más vieja es de hace ${sr.dias_mas_vieja} día(s).` : null}
                    actionLabel="Ir a ② Llamadas"
                    onGo={go('calls')}
                />
                <PendingTile
                    icon={CalendarCheck}
                    title="Agendas por contactar o confirmar"
                    count={pc.count || 0}
                    tone="amber"
                    detail={[
                        { label: 'Sin contactar', value: pc.sin_contactar || 0 },
                        { label: 'A medio conversar', value: pc.en_conversacion || 0 },
                        { label: 'La llamada es en 48 h', value: pc.proximas_48h || 0, strong: true }
                    ]}
                    hint={`${pc.confirmadas || 0} ya confirmada(s) para adelante.`}
                    actionLabel="Ir a ① Confirmaciones"
                    onGo={go('confirmations')}
                />
                <PendingTile
                    icon={MessageSquare}
                    title="Seguimientos sin hacer"
                    count={sg.count || 0}
                    tone="sky"
                    detail={[
                        { label: 'Vencidos', value: sg.vencidos || 0, strong: true },
                        { label: 'No tomadas', value: sg.no_tomada || 0 },
                        { label: 'Tomadas', value: sg.tomada || 0 },
                        { label: 'Llamadas cerradas (cobro)', value: sg.cerrada || 0 }
                    ]}
                    actionLabel="Ir a ③ Seguimientos"
                    onGo={go('seguimientos')}
                />
            </div>

            {paraCargar > 0 && (
                <p className="text-[10.5px] text-muted mt-4 leading-snug">
                    Además hay <b className="text-amber-400">{paraCargar}</b> dato(s) por cargar (cupos y reportes
                    diarios): están al final del dashboard, en «Para actualizar».
                </p>
            )}
        </Card>
    );
};

export default PerformancePendientes;
