import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { addDays, dayOfWeek, formatFechaLarga, formatHora, tzCiudad, ymdIn, ymdKey } from '../shared/time';

const ZONAS = [
    'America/Argentina/Buenos_Aires', 'America/La_Paz', 'America/Sao_Paulo', 'America/Santiago',
    'America/Bogota', 'America/Lima', 'America/Guayaquil', 'America/Mexico_City', 'America/Caracas',
    'America/Asuncion', 'America/Montevideo', 'America/Costa_Rica', 'Europe/Madrid',
];
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Elegir horario estilo Calendly: calendario del mes + horarios del día (escritorio), o tira de días
// + horarios (celular). Todo se muestra en la zona del lead; los horarios ya vienen filtrados por la
// estrategia, así que el lead nunca ve un horario de un closer que no le corresponde.
export default function PantallaHorario({ horarios, tz, onTz, reunion, onConfirmar }) {
    const porDia = useMemo(() => {
        const m = new Map();
        for (const h of horarios) {
            const k = ymdKey(ymdIn(h.utc, tz));
            if (!m.has(k)) m.set(k, []);
            m.get(k).push(h);
        }
        return m;
    }, [horarios, tz]);

    const dias = [...porDia.keys()];
    const [dia, setDia] = useState(dias[0] || null);
    const diaActivo = porDia.has(dia) ? dia : dias[0];
    const [elegido, setElegido] = useState(null);
    const [y0, m0] = (diaActivo || ymdKey(ymdIn(Date.now(), tz))).split('-').map(Number);
    const [mes, setMes] = useState({ y: y0, m: m0 });

    const zonas = ZONAS.includes(tz) ? ZONAS : [tz, ...ZONAS];

    const celdas = useMemo(() => {
        const primero = { y: mes.y, m: mes.m, d: 1 };
        const offset = (dayOfWeek(primero) + 6) % 7;
        const out = Array.from({ length: offset }, () => null);
        for (let d = primero; d.m === mes.m; d = addDays(d, 1)) out.push(d);
        return out;
    }, [mes]);

    const mesesConDias = new Set(dias.map(k => k.slice(0, 7)));
    const claveMes = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
    const mover = (n) => {
        const dt = new Date(Date.UTC(mes.y, mes.m - 1 + n, 1));
        setMes({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1 });
    };
    const prev = new Date(Date.UTC(mes.y, mes.m - 2, 1));
    const next = new Date(Date.UTC(mes.y, mes.m, 1));

    const elegirDia = (k) => { setDia(k); setElegido(null); };
    const delDia = porDia.get(diaActivo) || [];

    return (
        <div className="ag2-screen wide">
            <h2 className="ag2-q">Elegí el <span className="ag2-hl">horario</span> que te quede cómodo</h2>
            <p className="ag2-help">{reunion.titulo} · {reunion.duracion} minutos por Google Meet</p>

            {!horarios.length ? (
                <div className="ag2-empty" style={{ marginTop: 26 }}>
                    Ahora mismo no hay horarios disponibles. Te escribimos por WhatsApp para coordinar uno.
                </div>
            ) : (
                <div className="ag2-cal-wrap">
                    <div className="ag2-cal">
                        <div className="ag2-cal-head">
                            <button type="button" aria-label="Mes anterior" disabled={!mesesConDias.has(claveMes(prev.getUTCFullYear(), prev.getUTCMonth() + 1))} onClick={() => mover(-1)}><ChevronLeft size={16} /></button>
                            <span>{MESES[mes.m - 1]} {mes.y}</span>
                            <button type="button" aria-label="Mes siguiente" disabled={!mesesConDias.has(claveMes(next.getUTCFullYear(), next.getUTCMonth() + 1))} onClick={() => mover(1)}><ChevronRight size={16} /></button>
                        </div>
                        <div className="ag2-cal-grid">
                            {DOW.map((d, i) => <div key={i} className="ag2-cal-dow">{d}</div>)}
                            {celdas.map((c, i) => {
                                if (!c) return <div key={`v${i}`} />;
                                const k = ymdKey(c);
                                const av = porDia.has(k);
                                return (
                                    <button key={k} type="button" disabled={!av} aria-pressed={k === diaActivo}
                                        className={`ag2-cal-day ${av ? 'av' : ''} ${k === diaActivo ? 'sel' : ''}`}
                                        onClick={() => elegirDia(k)}>{c.d}</button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <div className="ag2-days" role="tablist" aria-label="Días disponibles">
                            {dias.map(k => {
                                const [y, m, d] = k.split('-').map(Number);
                                return (
                                    <button key={k} type="button" role="tab" aria-selected={k === diaActivo}
                                        className={`ag2-daychip ${k === diaActivo ? 'sel' : ''}`} onClick={() => elegirDia(k)}>
                                        <small>{DIAS_CORTOS[dayOfWeek({ y, m, d })]}</small><b>{d}</b>
                                    </button>
                                );
                            })}
                        </div>
                        {delDia[0] && <p className="ag2-slots-title" style={{ marginTop: 18 }}>{formatFechaLarga(delDia[0].utc, tz)}</p>}
                        <div className="ag2-slots">
                            {delDia.map(h => (
                                <div key={h.utc} className={`ag2-slot-row ${elegido === h.utc ? 'open' : ''}`}>
                                    <button type="button" className={`ag2-slot ${elegido === h.utc ? 'sel' : ''}`} onClick={() => setElegido(h.utc)}>
                                        {formatHora(h.utc, tz)}
                                    </button>
                                    {elegido === h.utc && (
                                        <button type="button" className="ag2-btn" style={{ justifyContent: 'center', height: 48 }} onClick={() => onConfirmar(h.utc)}>
                                            Confirmar
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <label className="ag2-tz">
                <Globe size={14} /> Horarios en
                <select value={tz} onChange={(e) => onTz(e.target.value)}>
                    {zonas.map(z => <option key={z} value={z}>{tzCiudad(z)}</option>)}
                </select>
            </label>
        </div>
    );
}
