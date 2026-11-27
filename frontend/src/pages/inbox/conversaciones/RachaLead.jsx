// En la tarjeta del lead (Mario, 27/11/2026): si le escribiste y no contestó, hace cuánto fue tu último mensaje
// (hoy, ayer, antes de ayer, hace N días) y en qué seguimiento vas desde su última respuesta, con puntitos; y cuántos
// seguimientos le hiciste en toda la conversación. Cada setter ve solo lo suyo: sus mensajes y los sin autor (Kommo, la
// app de Instagram), como el reporte y la lista (`seguimientos_hechos.resumen`); quien no es setter ve todo el equipo.
// Misma regla de seguimiento que el servidor: la marca a mano manda; sin marca, más de 12 h después del anterior.
import { Hourglass, Send } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { cierreMin, esWhatsapp, haceDias } from './colas';

// «45 min», «3 h», «2 d».
const duracion = (min) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : min < 1440 ? `${Math.floor(min / 60)} h` : `${Math.floor(min / 1440)} d`);

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
    // Un segmento por seguimiento (al menos 3, hasta 8 a la vista): los viejos en violeta, los que van desde su
    // última respuesta en magenta. Se dibujan de a uno al entrar.
    const segmentos = Math.min(8, Math.max(3, total));
    const largo = 100 / segmentos;
    const viejos = total - n;
    const queda = racha && contacto ? cierreMin(contacto, new Date()) : null;
    const red = contacto && esWhatsapp(contacto) ? 'WhatsApp' : 'Instagram';
    return (
        <div className="cv-racha">
            <span className="cv-racha-anillo"
                data-tip={`${total} ${total === 1 ? 'seguimiento' : 'seguimientos'} en total|${racha ? `${n} desde su última respuesta (en magenta)` : 'Contestó tu último mensaje'}`}>
                <svg viewBox="0 0 40 40" aria-hidden="true">
                    {Array.from({ length: segmentos }, (_, k) => (
                        <circle key={k} cx="20" cy="20" r="16" pathLength="100"
                            className={k < viejos ? 'is-viejo' : k < total ? 'is-nuevo' : ''}
                            style={{ '--seg': Math.max(1, largo - 9), '--k': k, strokeDashoffset: -(k * largo + 4.5) }} />
                    ))}
                </svg>
                <b key={total}>{total}</b>
            </span>
            <div className="cv-racha-info">
                <span className="cv-racha-tit">
                    Seguimientos
                    {racha && !n && <em className="cv-racha-cero" data-tip="Sin seguimiento|Le escribiste y todavía no le volviste a escribir">Falta el primero</em>}
                </span>
                <span className="cv-racha-chips">
                    {racha ? (
                        <>
                            <span data-tip={`Sin contestar|Tu último mensaje fue ${haceDias(racha.ultimo)}`}>
                                <Send size={11} aria-hidden="true" />{duracion((Date.now() - Date.parse(racha.ultimo)) / 60000)}
                            </span>
                            {contacto && (
                                <span className={queda == null ? 'cv-racha-cerrada' : 'cv-racha-queda'}
                                    data-tip={queda == null ? `Ventana cerrada|${red} no deja escribirle hasta que vuelva a escribir` : `Tiempo para escribirle|Después se cierra la ventana de ${red}`}>
                                    <Hourglass size={11} aria-hidden="true" />{queda == null ? 'cerrada' : duracion(queda)}
                                </span>
                            )}
                        </>
                    ) : <span className="cv-racha-ok">Contestó</span>}
                </span>
            </div>
        </div>
    );
}
