import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { localToday } from '../../../../utils/datetime';

const CUOTAS_POSIBLES = [2, 3, 4, 6, 8, 12];

// Mismo criterio que `_add_months` del backend: sumar meses sin que un día 31 se derrame al
// mes siguiente. Un vencimiento el 31 de enero pasa al 28/29 de febrero, no al 3 de marzo.
export const sumarMeses = (isoFecha, meses) => {
    const [y, m, d] = isoFecha.split('-').map(Number);
    const mesObjetivo = m - 1 + meses;
    const anio = y + Math.floor(mesObjetivo / 12);
    const mes = ((mesObjetivo % 12) + 12) % 12;
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    const dia = Math.min(d, ultimoDia);
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

// Reparto parejo con la última cuota absorbiendo el resto, igual que InstallmentService: si el
// frontend mostrara un reparto distinto al que el backend termina guardando, el closer le diría
// al cliente montos que después no coinciden con su cronograma.
export const repartir = (total, numCuotas) => {
    const cada = Math.round((total / numCuotas) * 100) / 100;
    const cuotas = Array.from({ length: numCuotas }, () => cada);
    const acumulado = Math.round(cada * (numCuotas - 1) * 100) / 100;
    cuotas[numCuotas - 1] = Math.round((total - acumulado) * 100) / 100;
    return cuotas;
};

const moneda = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Armador del cronograma de cobros para un cliente que debe pero nunca tuvo plan de cuotas.
 *
 * Hasta ahora esto solo se podía hacer desde el historial completo del cliente o desde el
 * wizard de declarar una venta, así que el closer que abría a un cliente en la cola de cobro y
 * veía "debe $900 · sin plan de cuotas" no tenía desde dónde ponerle fechas: la pantalla le
 * pedía cobrar algo que no tenía vencimiento.
 */
const ArmarPlanCuotas = ({ lead, onCreado, onCancelar }) => {
    const deuda = typeof lead?.deuda === 'number' ? lead.deuda : 0;
    const [total, setTotal] = useState(deuda > 0 ? String(Math.round(deuda)) : '');
    const [numCuotas, setNumCuotas] = useState(3);
    const [primeraFecha, setPrimeraFecha] = useState(() => sumarMeses(localToday(), 1));
    const [guardando, setGuardando] = useState(false);

    const totalNum = parseFloat(total) || 0;
    const cronograma = useMemo(() => {
        if (totalNum <= 0 || !primeraFecha) return [];
        return repartir(totalNum, numCuotas).map((monto, i) => ({
            numero: i + 1,
            monto,
            fecha: sumarMeses(primeraFecha, i)
        }));
    }, [totalNum, numCuotas, primeraFecha]);

    const faltantes = [];
    if (totalNum <= 0) faltantes.push('Poné cuánto queda por cobrar');
    if (!primeraFecha) faltantes.push('Elegí cuándo vence la primera cuota');

    const crear = async () => {
        if (faltantes.length) return;
        setGuardando(true);
        try {
            const { data } = await api.post('/closer/installments', {
                appointment_id: lead.id,
                total: totalNum,
                cobrado_hoy: 0,
                num_cuotas: numCuotas,
                fechas: cronograma.map(c => c.fecha),
                montos: cronograma.map(c => c.monto),
                programa_code: lead.programa_code || null
            });
            toast.success(`Plan de ${numCuotas} cuotas creado`);
            onCreado?.(data.cuotas || []);
        } catch (error) {
            // El 409 del backend trae el motivo exacto (ya hay cuotas pagadas en este programa):
            // mostrarlo tal cual le dice al closer qué hacer en vez de "error al guardar".
            toast.error(error?.response?.data?.error || 'No se pudo crear el plan de cuotas');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-center">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    Sin cronograma de cobros
                </p>
                <p className="text-[11px] font-medium text-amber-200/80 mt-0.5">
                    Poniéndole fechas, este cliente empieza a aparecer en tu cola de cobro el día que corresponde.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Saldo a financiar
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={total}
                        onChange={(e) => setTotal(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                    />
                    {deuda > 0 && (
                        <p className="text-[10px] font-medium text-slate-500">Debe {moneda(deuda)} según sus pagos.</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Vence la primera
                    </label>
                    <input
                        type="date"
                        value={primeraFecha}
                        onChange={(e) => setPrimeraFecha(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                    />
                    <p className="text-[10px] font-medium text-slate-500">Las siguientes caen mes a mes.</p>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    ¿En cuántas cuotas?
                </label>
                <div className="flex flex-wrap gap-2">
                    {CUOTAS_POSIBLES.map(n => (
                        <motion.button
                            key={n}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => setNumCuotas(n)}
                            className={`h-9 min-w-[44px] px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                numCuotas === n
                                    ? 'bg-violet-600 border-violet-500 text-white'
                                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                        >
                            {n}
                        </motion.button>
                    ))}
                </div>
            </div>

            {cronograma.length > 0 && (
                <motion.div
                    key={`${numCuotas}-${totalNum}-${primeraFecha}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-xl border border-slate-800 overflow-hidden"
                >
                    <div className="px-3 py-2 bg-slate-950/60 flex items-center gap-2">
                        <CalendarDays size={13} className="text-violet-400" />
                        <small className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Así le queda el cronograma
                        </small>
                    </div>
                    <table className="w-full text-xs">
                        <tbody>
                            {cronograma.map(c => (
                                <tr key={c.numero} className="border-t border-slate-800">
                                    <td className="px-3 py-2 font-bold text-white">Cuota {c.numero}</td>
                                    <td className="px-3 py-2 font-bold text-slate-300">{moneda(c.monto)}</td>
                                    <td className="px-3 py-2 font-bold text-slate-400 text-right">{c.fecha}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            )}

            {faltantes.length > 0 && (
                <p className="text-[11px] font-bold text-amber-300">{faltantes.join(' · ')}</p>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <button
                    onClick={onCancelar}
                    className="h-9 px-4 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                >
                    Volver
                </button>
                <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={crear}
                    disabled={faltantes.length > 0 || guardando}
                    className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide rounded-xl transition-all cursor-pointer flex items-center gap-2"
                >
                    {guardando ? <Loader2 size={12} className="animate-spin" /> : `Crear plan de ${numCuotas} cuotas`}
                </motion.button>
            </div>
        </div>
    );
};

export default ArmarPlanCuotas;
