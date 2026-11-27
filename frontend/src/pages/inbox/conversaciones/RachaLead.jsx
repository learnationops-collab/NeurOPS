// En la tarjeta del lead (Mario, 27/11/2026): si le escribiste y no contestó, hace cuánto fue tu último mensaje
// (hoy, ayer, antes de ayer, hace N días) y en qué seguimiento vas desde su última respuesta, con puntitos; y cuántos
// seguimientos le hiciste en toda la conversación. Cada setter ve solo lo suyo: sus mensajes y los sin autor (Kommo, la
// app de Instagram), como el reporte y la lista (`seguimientos_hechos.resumen`); quien no es setter ve todo el equipo.
// Misma regla de seguimiento que el servidor: la marca a mano manda; sin marca, más de 12 h después del anterior.
import { Hourglass, Repeat2, Send, Sigma } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { cierreMin, esWhatsapp, haceDias } from './colas';

// «45 min», «3 h», «2 d».
const duracion = (min) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : min < 1440 ? `${Math.floor(min / 60)} h` : `${Math.floor(min / 1440)} d`);

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

// `fase`: si ya agendó (Confirmación) o salió del embudo, no hay seguimiento que hacer: queda solo el total.
export default function RachaLead({ mensajes, fase, contacto }) {
    const { user } = useAuth() || {};
    const calculo = rachaDe(mensajes, user?.role === 'setter' ? user.id : null);
    const { total } = calculo;
    const racha = ['confirmacion', 'nolead', 'inabrible'].includes(fase) ? null : calculo.racha;
    if (!racha && !total) return null;
    const n = racha?.n ?? 0;
    const puntos = Math.max(3, n);
    return (
        <div className="cv-racha">
            {racha && (
                <>
                    {/* Cuánto lleva sin contestar y cuánto queda para escribirle (Mario, 27/11/2026). */}
                    <span className="cv-racha-cuando" data-tip={`Sin contestar|Tu último mensaje fue ${haceDias(racha.ultimo)}`}>
                        <Send size={12} aria-hidden="true" />{duracion((Date.now() - Date.parse(racha.ultimo)) / 60000)}
                    </span>
                    {contacto && (() => {
                        const queda = cierreMin(contacto, new Date());
                        const red = esWhatsapp(contacto) ? 'WhatsApp' : 'Instagram';
                        return (
                            <span className={`cv-racha-queda${queda == null ? ' cv-racha-queda--cerrada' : ''}`}
                                data-tip={queda == null ? `Ventana cerrada|${red} ya no deja escribirle hasta que vuelva a escribir` : `Tiempo para escribirle|Después se cierra la ventana de ${red}`}>
                                <Hourglass size={12} aria-hidden="true" />{queda == null ? 'cerrada' : `quedan ${duracion(queda)}`}
                            </span>
                        );
                    })()}
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
