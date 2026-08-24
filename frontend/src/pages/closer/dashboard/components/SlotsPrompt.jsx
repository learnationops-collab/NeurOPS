import { useState, useEffect, useCallback } from 'react';
import { Loader2, CalendarDays, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';

/* Captura de los cupos de agenda que faltan, al entrar al dashboard.
 *
 * Desde que el embudo se calcula desde la bandeja, los cupos son el ÚNICO dato que el sistema no
 * puede deducir solo: no hay ningún lugar donde quede registrado cuántos huecos abrió el closer
 * ese día. Antes se escribían dentro del reporte diario, así que un día sin reporte dejaba el
 * primer paso del embudo en un número imposible (menos cupos que agendas).
 *
 * Solo se piden los días CON agendas, y cada uno muestra su mínimo lógico: un cupo que se agendó
 * sigue siendo un cupo, así que el número nunca puede ser menor que las agendas de ese día. El
 * backend revalida eso y rechaza los que no cierran.
 */
const SlotsPrompt = ({ period, range, onSaved }) => {
    const [dias, setDias] = useState(null);
    const [valores, setValores] = useState({});
    const [saving, setSaving] = useState(false);
    const [oculto, setOculto] = useState(false);

    const fetchDias = useCallback(() => {
        // Mismo rango que el dashboard: con un período personalizado los cupos que faltan son
        // los de ESAS fechas, no los del mes en curso.
        if (period === 'custom' && !(range?.start && range?.end)) return;
        api.get('/closer/performance-dashboard/slots-pendientes', {
            params: {
                period,
                ...(period === 'custom' ? { start_date: range.start, end_date: range.end } : {})
            }
        })
            .then(res => {
                setDias(res.data.dias || []);
                setValores({});
            })
            .catch(err => console.error('Error al consultar los cupos pendientes:', err));
    }, [period, range?.start, range?.end]);

    useEffect(() => { setOculto(false); fetchDias(); }, [fetchDias]);

    if (oculto || !dias || dias.length === 0) return null;

    const completados = Object.entries(valores).filter(([, v]) => String(v).trim() !== '');

    const guardar = async () => {
        if (!completados.length) return;
        setSaving(true);
        try {
            const payload = Object.fromEntries(completados.map(([f, v]) => [f, Number(v)]));
            const res = await api.post('/closer/performance-dashboard/slots', { dias: payload });
            const { guardados = [], rechazados = [] } = res.data || {};
            if (guardados.length) toast.success(`${guardados.length} día(s) guardados`);
            rechazados.forEach(r => toast.error(`${r.date}: ${r.motivo}`));
            fetchDias();
            if (guardados.length) onSaved?.();
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudieron guardar los cupos');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-2">
                        <CalendarDays size={14} /> Faltan los cupos de {dias.length} día(s)
                    </h3>
                    <p className="text-xs text-muted mt-1.5 max-w-2xl">
                        Es el único dato que el sistema no puede sacar solo de tu bandeja, y sin él el primer paso del
                        embudo queda mal. Son los <b className="text-amber-200">cupos totales del día</b>: los que se
                        agendaron <b className="text-amber-200">más</b> los que quedaron libres — nunca menos que tus
                        agendas de ese día.
                    </p>
                </div>
                <button
                    onClick={() => setOculto(true)}
                    className="text-[10px] font-bold uppercase text-muted hover:text-white transition-colors cursor-pointer shrink-0"
                >
                    Ahora no
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {dias.map(d => (
                    <label key={d.date} className="bg-black/20 border border-amber-500/20 rounded-xl p-2.5 space-y-1.5">
                        <span className="text-[10px] font-bold text-muted block capitalize">
                            {d.weekday} {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                        </span>
                        <input
                            type="number"
                            min={d.minimo}
                            placeholder={`mín. ${d.minimo}`}
                            value={valores[d.date] ?? ''}
                            onChange={(e) => setValores(v => ({ ...v, [d.date]: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-bold text-white"
                        />
                        <span className="text-[9px] text-muted block">{d.agendas} agenda(s) ese día</span>
                    </label>
                ))}
            </div>

            <button
                onClick={guardar}
                disabled={!completados.length || saving}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-2"
            >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {completados.length ? `Guardar ${completados.length} día(s)` : 'Completá al menos uno'}
            </button>
        </div>
    );
};

export default SlotsPrompt;
