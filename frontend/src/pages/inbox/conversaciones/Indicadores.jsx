// Los indicadores de una conversación en poco espacio (ADR-W238), en la fila de la lista y arriba del chat:
//   · Etapa: una barrita con una rayita por fase del setting, llena hasta la actual, y su nombre corto. Si el bot
//     falló o está en pausa, un bot rojo o ámbar al lado. Reemplaza los tres puntos y el chip «2 Conexión».
//   · Espera: un reloj y cuánto hace que escribió el lead.
//   · Ventana: un anillo que se vacía con lo que queda para poder responder (WhatsApp 24 h, Instagram 7 días).
// El detalle va en el tooltip.
import { Bot, Clock } from 'lucide-react';
import { colorEspera, esWhatsapp, textoEspera } from './colas';
import { FASES, TRAMOS, colorDe, corto, faseDe, ordenDe } from './fasesSetting';

const EMBUDO = FASES.filter((f) => f.tramo !== 'salida');
const BOT = {
    fallida: { color: 'var(--error)', texto: 'El bot no pudo seguir: falló o se cerró la ventana' },
    pausada: { color: 'var(--warning)', texto: 'El bot está en pausa para esta persona' },
};

// «23 h», «45 min», «3 d»: lo justo para el anillo y el reloj.
export function cortito(min) {
    if (min >= 24 * 60) return `${Math.floor(min / (24 * 60))} d`;
    if (min >= 60) return `${Math.floor(min / 60)} h`;
    return `${min} min`;
}

export function EtapaMini({ fase, etapas }) {
    const bot = BOT[etapas?.auto];
    if (!fase && !bot) return null;
    const f = fase ? faseDe(fase) : null;
    const actual = f ? ordenDe(f.id) : -1;
    return (
        <span className="cv-etapa-mini">
            {f && (
                <span className="cv-etapa-mini-in" style={{ '--c': colorDe(f) }} data-tip={`Etapa ${f.n} de ${EMBUDO.length}|${TRAMOS[f.tramo].nombre} · ${f.label}`}>
                    {f.tramo === 'salida'
                        ? <span className="cv-etapa-mini-salida">{f.n}</span>
                        : <span className="cv-etapa-mini-barra" aria-hidden="true">
                            {EMBUDO.map((x, i) => <i key={x.id} className={i <= actual ? 'on' : ''} style={{ '--c': colorDe(x), '--i': i }} />)}
                        </span>}
                    <span>{corto(f)}</span>
                </span>
            )}
            {bot && <span className="cv-etapa-mini-bot" style={{ '--c': bot.color }} data-tip={`Bot|${bot.texto}`}><Bot size={12} aria-label="Bot" /></span>}
        </span>
    );
}

export function Espera({ min, desde }) {
    if (min == null) return null;
    return (
        <span className="cv-ind" style={{ '--c': colorEspera(min) || 'var(--text-muted)' }}
            data-tip={`Espera respuesta|Escribió hace ${textoEspera(min)}${desde ? ` (${desde})` : ''}`}>
            <Clock size={12} aria-hidden="true" />{cortito(min)}
        </span>
    );
}

const R = 7;
const VUELTA = 2 * Math.PI * R;

// `queda`: minutos para poder responder (null = ya se cerró). `aviso`: desde cuándo se pone en rojo y late.
export function Ventana({ contacto, queda, aviso }) {
    const wa = esWhatsapp(contacto);
    const total = (wa ? 24 : 7 * 24) * 60;
    const cerrada = queda == null;
    const parte = cerrada ? 0 : Math.min(1, queda / total);
    const urgente = cerrada || queda <= aviso;
    const tip = cerrada
        ? `Ventana cerrada|${wa ? 'WhatsApp solo deja escribirle con una plantilla' : 'Instagram no deja escribirle hasta que vuelva a escribir'}`
        : `Para responder|Quedan ${textoEspera(queda)}. ${wa ? 'WhatsApp deja escribirle hasta 24 h después de su último mensaje' : 'Instagram deja escribirle hasta 7 días después de su último mensaje'}`;
    return (
        <span className={`cv-ind cv-ventana${urgente ? ' cv-ventana--urgente' : ''}`} style={{ '--c': urgente ? 'var(--error)' : 'var(--success)' }} data-tip={tip}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <circle cx="9" cy="9" r={R} className="cv-ventana-fondo" />
                <circle cx="9" cy="9" r={R} className="cv-ventana-resto" transform="rotate(-90 9 9)"
                    style={{ '--vuelta': VUELTA, strokeDasharray: VUELTA, strokeDashoffset: VUELTA * (1 - parte) }} />
            </svg>
            {cerrada ? 'cerrada' : cortito(queda)}
        </span>
    );
}
