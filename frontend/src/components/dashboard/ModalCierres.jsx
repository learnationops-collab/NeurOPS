import { CalendarCheck, PhoneCall, PhoneOff } from 'lucide-react';
import Modal from '../ui/Modal';
import { parseUtcIso } from '../../utils/datetime';

/**
 * Los cobros detrás del close rate real, cada uno con la llamada de la que salió (23/10/2026).
 *
 * Las filas llegan en el bloque `cierres.reales.filas` (ver `cierres_reales.py`), así que no hay
 * pedido. Van agrupadas por origen —primero lo que la tasa de abajo NO veía, las llamadas
 * anteriores—, porque lo que se viene a mirar acá es qué ventas de este período venían de antes.
 */

const GRUPOS = [
    {
        key: 'anterior', titulo: 'De llamadas anteriores', Icono: CalendarCheck,
        nota: 'La llamada es de antes del período: una seña, un seguimiento o una segunda llamada que se cerró ahora.',
        tono: 'text-emerald-300',
    },
    {
        key: 'periodo', titulo: 'De llamadas del período', Icono: PhoneCall,
        nota: 'La llamada y el cierre son de este período.',
        tono: 'text-sky-300',
    },
    {
        key: 'sin_llamada', titulo: 'Sin llamada', Icono: PhoneOff,
        nota: 'No hay una llamada con show up en los 90 días anteriores (un upsell, una venta directa). Quedan fuera de la tasa.',
        tono: 'text-slate-400',
    },
];

const dos = (x) => String(x).padStart(2, '0');

/** `08/10` del día de un cobro (llega como fecha ISO sin zona: no se corre de día). */
const diaDe = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** `20/09` de una llamada, en el reloj de quien mira (llega en UTC y sin zona). */
const llamadaDe = (iso) => {
    const d = parseUtcIso(iso);
    return d ? `${dos(d.getDate())}/${dos(d.getMonth() + 1)}` : '';
};

const dinero = (v) => `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`;

const plural = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`;

const Fila = ({ fila }) => (
    <li className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
        <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <b className="min-w-0 max-w-full truncate text-[14px] text-white" title={fila.cliente}>{fila.cliente}</b>
                <small className="shrink-0 rounded-md border border-slate-700 bg-slate-800/70 px-1.5 py-px text-[10px] font-bold text-slate-300">
                    {fila.tipo}
                </small>
            </span>
            <small className="mt-1 block text-[11.5px] font-semibold text-slate-500">
                {fila.llamada
                    ? `Llamada del ${llamadaDe(fila.llamada.fecha)}${fila.llamada.closer ? ` · ${fila.llamada.closer}` : ''}`
                    : 'Sin llamada previa'}
                {fila.via === 'cuota' ? ' · seña completada con cuota' : ''}
            </small>
        </span>
        <span className="shrink-0 text-right">
            <b className="block text-[14px] tabular-nums text-white">{dinero(fila.monto)}</b>
            <small className="text-[11px] font-semibold text-slate-500 tabular-nums">cobrado el {diaDe(fila.fecha)}</small>
        </span>
    </li>
);

const ModalCierres = ({ filas, total, onCerrar }) => (
    <Modal ancho="3xl" titulo="Cobros del close rate real" onCerrar={onCerrar}
        icono={<CalendarCheck size={18} className="text-emerald-300" />}
        subtitulo={`${plural(total, 'cobro', 'cobros')} de venta del período, con la llamada de la que salió cada uno`}>
        <div className="grid gap-6">
            {GRUPOS.map(({ key, titulo, nota, Icono, tono }) => {
                const delGrupo = filas.filter(f => f.origen === key);
                if (!delGrupo.length) return null;
                return (
                    <section key={key} aria-label={titulo} className="grid gap-2">
                        <div className="grid gap-0.5">
                            <h4 className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest ${tono}`}>
                                <Icono size={14} aria-hidden="true" />
                                {titulo} · {delGrupo.length}
                            </h4>
                            <small className="text-[11px] leading-snug text-slate-500">{nota}</small>
                        </div>
                        <ul className="grid gap-2">
                            {delGrupo.map(f => <Fila key={`${f.via}-${f.id}`} fila={f} />)}
                        </ul>
                    </section>
                );
            })}
            {filas.length === 0 && (
                <p className="py-6 text-center text-[13px] text-slate-400">No hay cobros de venta en el período.</p>
            )}
        </div>
    </Modal>
);

export default ModalCierres;
