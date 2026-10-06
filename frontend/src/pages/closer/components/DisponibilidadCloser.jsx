// La disponibilidad del closer: sus franjas de cada día y su zona horaria. Es el horario de su persona de
// Team en Agendamiento (el mismo que edita la dirección comercial): de ahí salen los horarios que el
// sistema de agendas ofrece a los leads. La zona se adivina por el país de su WhatsApp mientras no elija
// una (app/api/auth.py, /auth/me/disponibilidad).

import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import Button from '../../../components/ui/Button';

// Lunes primero; las claves del horario son 0 (domingo) a 6 (sábado).
const DIAS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
const franjasDe = (horario, dia) => (horario && (horario[dia] || horario[String(dia)])) || [];

export default function DisponibilidadCloser() {
    const [datos, setDatos] = useState(null); // { horario, tz, zonas, horas, en_team }
    const [horario, setHorario] = useState({});
    const [tz, setTz] = useState('');
    const [cambios, setCambios] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);

    const aplicar = (r) => {
        setDatos(r);
        setHorario(Object.fromEntries(DIAS.map(([k]) => [k, franjasDe(r.horario, k)])));
        setTz(r.tz);
        setCambios(false);
    };
    useEffect(() => {
        api.get('/auth/me/disponibilidad').then((r) => aplicar(r.data)).catch(() => setError('No se pudo leer tu disponibilidad.'));
    }, []);

    const editar = (dia, franjas) => { setHorario((h) => ({ ...h, [dia]: franjas })); setCambios(true); setAviso(null); };
    const guardar = async () => {
        setOcupado(true); setError(null);
        try {
            const r = await api.put('/auth/me/disponibilidad', { horario, tz });
            aplicar(r.data);
            setAviso('Listo: tu disponibilidad quedó guardada.');
        } catch (e) {
            setError(e?.response?.data?.message || 'No se pudo guardar. Probá de nuevo.');
        } finally { setOcupado(false); }
    };

    if (!datos && !error) return <div className="p-6 text-sm text-slate-400 animate-pulse">Cargando tu disponibilidad…</div>;
    if (!datos) return <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>;

    const horas = datos.horas || [];
    const selectHora = (valor, onChange, label) => (
        <select aria-label={label} value={valor} onChange={(e) => onChange(e.target.value)}
            className="px-2 py-1.5 bg-main border border-base rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40">
            {horas.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
    );

    return (
        <div className="bg-surface p-6 rounded-[2rem] border border-base space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center"><CalendarClock size={20} /></div>
                <div>
                    <h3 className="text-base font-black">Disponibilidad</h3>
                    <p className="text-xs text-muted">Los horarios en los que el sistema te ofrece a los leads. La dirección comercial también puede ajustarlos.</p>
                </div>
            </div>

            <label className="block space-y-1">
                <span className="text-[11px] font-bold text-muted">Tu zona horaria</span>
                <select value={tz} onChange={(e) => { setTz(e.target.value); setCambios(true); setAviso(null); }}
                    className="w-full px-4 py-3 bg-main border border-base rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40">
                    {(datos.zonas || []).map((z) => <option key={z.tz} value={z.tz}>{z.n}</option>)}
                </select>
            </label>

            <ul className="divide-y divide-base">
                {DIAS.map(([k, nombre]) => {
                    const franjas = horario[k] || [];
                    return (
                        <li key={k} className="py-3 flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 w-32 text-sm font-bold">
                                <input type="checkbox" checked={franjas.length > 0} aria-label={'Trabajo el ' + nombre.toLowerCase()}
                                    onChange={(e) => editar(k, e.target.checked ? [['09:00', '18:00']] : [])} />
                                {nombre}
                            </label>
                            {!franjas.length && <span className="text-xs text-muted">No disponible</span>}
                            {franjas.map(([desde, hasta], i) => (
                                <span key={i} className="flex items-center gap-1.5">
                                    {selectHora(desde, (v) => editar(k, franjas.map((f, j) => (j === i ? [v, f[1]] : f))), nombre + ' desde')}
                                    <span className="text-xs text-muted">a</span>
                                    {selectHora(hasta, (v) => editar(k, franjas.map((f, j) => (j === i ? [f[0], v] : f))), nombre + ' hasta')}
                                    <button type="button" aria-label={'Quitar franja del ' + nombre.toLowerCase()} className="p-1.5 text-muted hover:text-rose-400"
                                        onClick={() => editar(k, franjas.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                                </span>
                            ))}
                            {franjas.length > 0 && franjas.length < 6 && (
                                <button type="button" aria-label={'Sumar franja al ' + nombre.toLowerCase()} className="p-1.5 text-muted hover:text-primary"
                                    onClick={() => editar(k, [...franjas, ['14:00', '18:00']])}><Plus size={14} /></button>
                            )}
                        </li>
                    );
                })}
            </ul>

            {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
            {aviso && <p role="status" className="text-xs font-bold text-emerald-400">{aviso}</p>}
            <div className="flex justify-end">
                <Button variant="primary" onClick={guardar} disabled={ocupado || !cambios}>{ocupado ? 'Guardando…' : 'Guardar disponibilidad'}</Button>
            </div>
        </div>
    );
}
