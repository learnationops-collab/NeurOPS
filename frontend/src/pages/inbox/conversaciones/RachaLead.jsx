// En la tarjeta del lead (Mario, 27/11/2026): si le escribiste y no contestó, hace cuánto fue tu último mensaje
// (hoy, ayer, antes de ayer, hace N días) y en qué seguimiento vas desde su última respuesta, con puntitos; y cuántos
// seguimientos le hiciste en toda la conversación. Cada setter ve solo lo suyo: sus mensajes y los sin autor (Kommo, la
// app de Instagram), como el reporte y la lista (`seguimientos_hechos.resumen`); quien no es setter ve todo el equipo.
// Misma regla de seguimiento que el servidor: la marca a mano manda; sin marca, más de 12 h después del anterior.
import { Repeat2, Send, Sigma } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { haceDias } from './colas';

const ORDINAL = ['', 'Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto'];
const DOCE_H = 12 * 3600000;

export function rachaDe(mensajes, setterId = null) {
    let total = 0;
    let n = 0;
    let previo = null;
    let del = [];
    (mensajes || []).forEach((m) => {
        if (m.origen === 'motor') return;
        if (m.direccion === 'entrante') { previo = null; n = 0; del = []; return; }
        if (setterId != null && m.autor_id != null && m.autor_id !== setterId) return;
        const en = Date.parse(m.en);
        const es = m.marca != null ? Boolean(m.marca) : previo != null && en - previo >= DOCE_H;
        if (es) { n += 1; total += 1; }
        del.push(m);
        previo = en;
    });
    return { total, racha: del.length ? { n, ultimo: del[del.length - 1].en } : null };
}

export default function RachaLead({ mensajes }) {
    const { user } = useAuth() || {};
    const { total, racha } = rachaDe(mensajes, user?.role === 'setter' ? user.id : null);
    if (!racha && !total) return null;
    const n = racha?.n ?? 0;
    const puntos = Math.max(3, n);
    return (
        <div className="cv-racha">
            {racha && (
                <>
                    <span className="cv-racha-cuando" data-tip="Tu último mensaje|Todavía no contestó">
                        <Send size={12} aria-hidden="true" />{haceDias(racha.ultimo)}
                    </span>
                    <span className={`cv-racha-n${n ? '' : ' cv-racha-n--cero'}`}
                        data-tip={n ? 'Seguimientos desde su última respuesta|Cuentan los que marcaste y los de más de 12 h' : 'Sin seguimiento|Le escribiste y todavía no le volviste a escribir'}>
                        <Repeat2 size={12} aria-hidden="true" />
                        {n ? `${ORDINAL[n] || `${n}.º`} seguimiento` : 'Sin seguimiento'}
                        <span className="cv-racha-puntos" aria-hidden="true">
                            {Array.from({ length: puntos }, (_, k) => <i key={k} className={k < n ? 'is-on' : ''} style={{ '--k': k }} />)}
                        </span>
                    </span>
                </>
            )}
            {total > 0 && (
                <span className="cv-racha-total" data-tip={`En total|${total} ${total === 1 ? 'seguimiento' : 'seguimientos'} en toda la conversación`}>
                    <Sigma size={11} aria-hidden="true" />{total}
                </span>
            )}
        </div>
    );
}
