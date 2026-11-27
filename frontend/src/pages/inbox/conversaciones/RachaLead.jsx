// En la tarjeta del lead (Mario, 27/11/2026): si le escribiste y no contestó, hace cuánto fue tu último mensaje
// (hoy, ayer, antes de ayer, hace N días) y en qué seguimiento vas desde su última respuesta, con puntitos; y cuántos
// seguimientos le hiciste en toda la conversación. Sale de los mensajes del chat: `seguimiento` es el número que les
// pone el servidor (`seguimientos_hechos.numerados`); los del bot no cuentan.
import { Repeat2, Send, Sigma } from 'lucide-react';
import { haceDias } from './colas';

const ORDINAL = ['', 'Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto'];

export function rachaDe(mensajes) {
    const propios = (mensajes || []).filter((m) => m.origen !== 'motor');
    const total = propios.filter((m) => m.direccion === 'saliente' && m.seguimiento).length;
    let i = propios.length - 1;
    while (i >= 0 && propios[i].direccion !== 'entrante') i -= 1;
    const despues = propios.slice(i + 1).filter((m) => m.direccion === 'saliente');
    if (!despues.length) return { total, racha: null };
    return { total, racha: { n: despues.filter((m) => m.seguimiento).length, ultimo: despues[despues.length - 1].en } };
}

export default function RachaLead({ mensajes }) {
    const { total, racha } = rachaDe(mensajes);
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
