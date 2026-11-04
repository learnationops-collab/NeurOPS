// Resumen previo al envío del «reporte del día»: qué se hizo y qué quedó sin resultado, con un
// salto directo a la lista (Mi cartera) para corregirlo. Pedido del 04/11/2026: los closers
// enviaban el reporte y después aparecían agendas sin reportar o de nuevo en Pendiente.
//
// Presentacional: la página pide los datos (`GET /closer/deck/daily-report/summary`) y decide qué
// hacer con «Corregir» y «Enviar».

import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { etiquetaDia } from './DiaDelReporte';

const hora = (iso) => {
    if (!iso) return '';
    const d = new Date(`${iso}${/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? '' : 'Z'}`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
};

const Kpi = ({ valor, rotulo }) => (
    <div className="flex-1 min-w-[90px] rounded-lg bg-slate-800/60 px-3 py-2">
        <b className="block text-xl font-bold text-white">{valor}</b>
        <span className="text-[11px] text-slate-400">{rotulo}</span>
    </div>
);

const Aviso = ({ icono: Icono, tono = 'warn', children, accion }) => (
    <div className="flex items-center gap-3 py-2.5 border-t border-slate-800 text-[13px] text-slate-200">
        <Icono size={18} className={tono === 'warn' ? 'text-amber-400 shrink-0' : 'text-slate-400 shrink-0'} aria-hidden="true" />
        <div className="flex-1 min-w-0">{children}</div>
        {accion}
    </div>
);

const ResumenDelDia = ({ dia, datos, cargando, enviando, reenvio, onCorregir, onVerAtrasadas, onSeguir, onEnviar }) => {
    const sin = datos?.sin_resultado || [];
    const atrasadas = datos?.pending_previous_days?.total || 0;
    const volvieron = sin.filter((a) => a.reportada_hoy);
    const nombres = sin.slice(0, 3).map((a) => a.cliente).join(', ') + (sin.length > 3 ? `… +${sin.length - 3}` : '');

    return (
        <Modal
            titulo={`Resumen de ${etiquetaDia(dia, { largo: true })}`}
            subtitulo="Revisalo antes de enviar"
            ancho="lg"
            tono="slate"
            cerrable={!enviando}
            onCerrar={onSeguir}
            pie={(
                <>
                    <button type="button" onClick={onSeguir} disabled={enviando}
                        className="h-10 px-5 rounded-full border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer">
                        Seguir editando
                    </button>
                    <button type="button" onClick={onEnviar} disabled={cargando || enviando}
                        className="h-10 px-5 rounded-full text-white text-xs font-black uppercase tracking-wider cursor-pointer flex items-center gap-2 disabled:opacity-50"
                        style={{ background: 'var(--v6-gradb)' }}>
                        {enviando && <Loader2 size={14} className="animate-spin" />}
                        {sin.length > 0 ? 'Enviar igual' : reenvio ? 'Actualizar y reenviar' : 'Enviar reporte'}
                    </button>
                </>
            )}
        >
            {cargando || !datos ? (
                <div className="flex items-center gap-2 py-8 justify-center text-slate-400 text-sm">
                    <Loader2 size={16} className="animate-spin" /> Armando el resumen…
                </div>
            ) : (
                <div>
                    <div className="flex gap-2 flex-wrap mb-4">
                        <Kpi valor={datos.totales.agendas} rotulo="Agendas del día" />
                        <Kpi valor={datos.totales.con_resultado} rotulo="Con resultado" />
                        <Kpi valor={datos.totales.asistieron} rotulo="Asistieron" />
                        <Kpi valor={datos.totales.ventas} rotulo="Ventas" />
                    </div>

                    {sin.length === 0 && atrasadas === 0 ? (
                        <p className="text-[13px] text-emerald-300 py-2">
                            Todo reportado: no queda ninguna agenda sin resultado.
                        </p>
                    ) : (
                        <>
                            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Para revisar antes de enviar</p>
                            {sin.length > 0 && (
                                <Aviso icono={AlertTriangle}
                                    accion={<button type="button" onClick={onCorregir} className="text-xs font-bold underline cursor-pointer text-white">Corregir ↗</button>}>
                                    {sin.length} agenda{sin.length === 1 ? '' : 's'} sin resultado
                                    <span className="text-slate-400"> · {nombres}</span>
                                </Aviso>
                            )}
                            {volvieron.length > 0 && (
                                <Aviso icono={AlertTriangle}>
                                    {volvieron.length === 1 ? '1 agenda que guardaste hoy figura' : `${volvieron.length} agendas que guardaste hoy figuran`} otra vez en Pendiente
                                    <span className="text-slate-400"> · {volvieron.map((a) => `${a.cliente}${hora(a.fecha) ? ` (${hora(a.fecha)})` : ''}`).slice(0, 3).join(', ')}</span>
                                </Aviso>
                            )}
                            {atrasadas > 0 && (
                                <Aviso icono={Clock} tono="calma"
                                    accion={<button type="button" onClick={onVerAtrasadas} className="text-xs font-bold underline cursor-pointer text-white">Ver ↗</button>}>
                                    {atrasadas} tarea{atrasadas === 1 ? '' : 's'} atrasada{atrasadas === 1 ? '' : 's'} de días anteriores
                                </Aviso>
                            )}
                        </>
                    )}
                    {datos.por_ocurrir > 0 && (
                        <p className="text-[11px] text-slate-500 mt-2">
                            {datos.por_ocurrir} agenda{datos.por_ocurrir === 1 ? '' : 's'} todavía no ocurr{datos.por_ocurrir === 1 ? 'ió' : 'ieron'}: no cuentan como faltantes.
                        </p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-3">Después de corregir, volvé a tocar «Enviar reporte» y el resumen se arma de nuevo.</p>
                </div>
            )}
        </Modal>
    );
};

export default ResumenDelDia;
