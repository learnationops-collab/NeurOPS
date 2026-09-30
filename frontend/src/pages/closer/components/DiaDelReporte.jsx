// Qué día se está cerrando en «Cerrar el día»: hoy o ayer. Pedido del usuario (30/09/2026): «que
// me pueda permitir reportar el día de ayer». Más atrás no: el backend rechaza cualquier otra
// fecha (ver `_dia_reportable` en app/api/closer.py), así que acá no hay calendario, solo dos
// opciones. Las fechas de "hoy" y "ayer" las manda el backend en la zona del closer, no el reloj
// del navegador, que puede estar en otra zona (un admin simulando a un closer de otro país).
//
// Presentacional: la página decide qué día pedir y qué hacer al elegir.

import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { parseUtcIso } from '../../../utils/datetime';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const pad2 = (n) => String(n).padStart(2, '0');

// 'AAAA-MM-DD' → «mar 29/09» (o «martes 29/09» con `largo`). Se arma a mano y no con
// `new Date('AAAA-MM-DD')`, que la lee como UTC y al oeste de Greenwich da el día anterior.
export const etiquetaDia = (iso, { largo = false } = {}) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const nombre = DIAS[new Date(y, m - 1, d).getDay()];
    return `${largo ? nombre : nombre.slice(0, 3)} ${pad2(d)}/${pad2(m)}`;
};

// «✓ Enviado 14:05», o «✓ Enviado el 30/09 · 09:15» si se mandó otro día que el reportado (el de
// ayer, mandado hoy). `sent_at` viene en UTC sin zona: `parseUtcIso` lo pasa a la hora local.
const textoEnviado = (enviadoEl, dia) => {
    const cuando = parseUtcIso(enviadoEl);
    if (!cuando) return '✓ Enviado';
    const hora = `${pad2(cuando.getHours())}:${pad2(cuando.getMinutes())}`;
    const fecha = `${cuando.getFullYear()}-${pad2(cuando.getMonth() + 1)}-${pad2(cuando.getDate())}`;
    if (fecha !== dia) return `✓ Enviado el ${pad2(cuando.getDate())}/${pad2(cuando.getMonth() + 1)} · ${hora}`;
    return `✓ Enviado ${hora}`;
};

const DiaDelReporte = ({ hoy, ayer, valor, onElegir, enviado, enviadoEl, ayerSinReportar, agendasDeAyer, cargando }) => {
    const reducido = useReducedMotion();
    const esAyer = valor === ayer;
    const opciones = [
        { fecha: hoy, rotulo: 'Hoy' },
        { fecha: ayer, rotulo: 'Ayer' },
    ];

    return (
        <div className="rpt-card-v6" style={{ padding: '14px 20px' }}>
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                    <small className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reportando el día</small>
                    <span className="text-xs font-bold text-white">
                        {esAyer ? 'Ayer' : 'Hoy'} · {etiquetaDia(valor, { largo: true })}
                    </span>
                </div>

                <div
                    role="radiogroup"
                    aria-label="Qué día reportás"
                    className="flex items-center p-1 rounded-full"
                    style={{ background: 'rgba(0,0,0,.28)', border: '1px solid var(--v6-bd)' }}
                >
                    {opciones.map(({ fecha, rotulo }) => {
                        const activo = valor === fecha;
                        return (
                            <button
                                key={rotulo}
                                type="button"
                                role="radio"
                                aria-checked={activo}
                                onClick={() => { if (!activo) onElegir(fecha); }}
                                className="relative h-8 px-4 rounded-full text-[11px] font-black cursor-pointer flex items-center gap-1.5"
                                style={{ color: activo ? '#fff' : 'var(--v6-tx3)' }}
                            >
                                {/* Mismo recurso que la pestaña activa del nav: un solo fondo que se
                                    desliza de una opción a la otra en vez de saltar. */}
                                {activo && (
                                    <motion.span
                                        layoutId="dia-del-reporte-pill"
                                        className="absolute inset-0 rounded-full"
                                        style={{ background: 'rgba(255,63,164,.12)', border: '1px solid rgba(255,63,164,.5)' }}
                                        transition={reducido ? { duration: 0 } : { type: 'spring', bounce: 0.2, duration: 0.45 }}
                                    />
                                )}
                                <span className="relative">{rotulo}</span>
                                <span className="relative font-bold" style={{ color: 'var(--v6-tx3)' }}>{etiquetaDia(fecha)}</span>
                                {rotulo === 'Ayer' && ayerSinReportar && (
                                    <span
                                        className="relative w-1.5 h-1.5 rounded-full"
                                        style={{ background: 'var(--v6-warn)' }}
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {enviado && (
                    <span className="tud-xp-v6" style={{ color: '#7DEAC0', background: 'rgba(47,191,143,.14)', borderColor: 'rgba(47,191,143,.32)' }}>
                        {textoEnviado(enviadoEl, valor)}
                    </span>
                )}
                {cargando && <Loader2 size={14} className="animate-spin text-slate-500" aria-label="Cargando" />}
            </div>

            {ayerSinReportar && !esAyer && (
                <motion.div
                    role="status"
                    initial={reducido ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mt-3 flex items-center gap-2.5 flex-wrap px-4 py-2.5 rounded-full border text-[11px] font-bold bg-amber-500/10 border-amber-500/30 text-amber-300"
                >
                    <span aria-hidden="true">⏳</span>
                    <span>Ayer quedó sin reportar</span>
                    {agendasDeAyer > 0 && (
                        <span className="font-semibold" style={{ color: 'rgba(243,208,138,.75)' }}>
                            — tuviste {agendasDeAyer} agenda{agendasDeAyer === 1 ? '' : 's'} el {etiquetaDia(ayer, { largo: true })}
                        </span>
                    )}
                    <button
                        type="button"
                        className="ml-auto underline font-black uppercase cursor-pointer"
                        onClick={() => onElegir(ayer)}
                    >
                        Reportar ayer
                    </button>
                </motion.div>
            )}

            {esAyer && (
                <p className="mt-3 text-[11px] font-bold" style={{ color: '#F3D08A' }}>
                    Estás cerrando ayer: se guarda como el reporte del {etiquetaDia(ayer, { largo: true })} y en Discord se aclara que lo mandaste hoy.
                </p>
            )}
        </div>
    );
};

export default DiaDelReporte;
