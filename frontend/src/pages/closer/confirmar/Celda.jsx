// El valor de una propiedad de la agenda en una celda de la lista, o en una línea de la semana.
import { formatCountdown } from '../../../utils/datetime';
import { ETAPAS_CONFIRMACION, etapaDeConfirmacion } from './etapas';
import { avisosDe, cuandoEs, decisionDe, esDeFormulario, inversionDe, respuestaDe } from './propiedades';

const TONO_SEGMENTO = { A: 'var(--cl-success, #3ecf8e)', B: 'var(--cl-info, #5aa9ff)', C: 'var(--cl-warning, #f5b84a)', D: 'var(--cl-magenta, #ff3fa4)' };
const fmtPuntos = (n) => (Number(n) > 0 ? '+' : '') + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });

export const Etiqueta = ({ color, children, title }) => <span className="cv-tag" style={{ '--c': color }} title={title}>{children}</span>;

// Rojo si ya pasó sin confirmar, ámbar si falta poco, verde si hay tiempo; gris si ya está confirmada.
export function urgenciaDe(a, ahora) {
    const c = formatCountdown(a.start_time, ahora);
    const confirmada = etapaDeConfirmacion(a) === 'confirmado';
    if (!c) return { texto: '', color: 'var(--ui-faint)' };
    const color = confirmada ? 'var(--ui-muted)'
        : c.kind === 'past' ? 'var(--ui-danger, #f87171)'
        : c.kind === 'now' || c.kind === 'soon' || cuandoEs(a).ms - ahora < 2 * 3600000 ? 'var(--cl-warning, #f5b84a)'
        : 'var(--cl-success, #3ecf8e)';
    return { texto: c.label, color };
}

export const textoDe = (a, clave, { nombreCloser } = {}) => {
    if (esDeFormulario(clave)) return respuestaDe(a, clave);
    switch (clave) {
        case 'hora': return cuandoEs(a).hora || '';
        case 'telefono': return (a.phone || '').trim();
        case 'closer': return nombreCloser ? nombreCloser(a) : a.closer_name || '';
        case 'etapa': return ETAPAS_CONFIRMACION.find(e => e.clave === etapaDeConfirmacion(a))?.titulo || '';
        case 'segmento': return a.segmento ? (a.segmento_puntos != null ? `${a.segmento} · ${fmtPuntos(a.segmento_puntos)} pts` : a.segmento) : '';
        case 'avisos': return avisosDe(a).join(' · ');
        case 'origen': return a.origin || 'Meta Ads';
        case 'examen': return a.examen || '';
        case 'inversion': return inversionDe(a);
        case 'decision': return decisionDe(a);
        case 'notas_setter': return a.setter_notes || '';
        default: return '';
    }
};

export default function Celda({ agenda: a, clave, ahora, nombreCloser }) {
    if (clave === 'hora') {
        const u = urgenciaDe(a, ahora);
        return <span className="cv-hora"><b>{cuandoEs(a).hora}</b> <small style={{ color: u.color }}>{u.texto}</small></span>;
    }
    if (clave === 'etapa') {
        const i = ETAPAS_CONFIRMACION.findIndex(e => e.clave === etapaDeConfirmacion(a));
        const e = ETAPAS_CONFIRMACION[i];
        return (
            <span className="cv-etapa" style={{ '--c': e.color }}>
                <span className="cv-pasos" aria-hidden="true">{ETAPAS_CONFIRMACION.map((x, j) => <i key={x.clave} className={j <= i ? 'on' : ''} />)}</span>
                {e.titulo}
            </span>
        );
    }
    if (clave === 'closer') return <span className="cv-txt">{textoDe(a, clave, { nombreCloser }) || '—'}</span>;
    if (clave === 'segmento' && a.segmento) return <Etiqueta color={TONO_SEGMENTO[a.segmento]}>{textoDe(a, clave)}</Etiqueta>;
    if (clave === 'avisos') {
        const avisos = avisosDe(a);
        return avisos.length ? avisos.map(t => <Etiqueta key={t} color="var(--cl-warning, #f5b84a)">{t}</Etiqueta>) : <span className="cv-mute">—</span>;
    }
    const t = textoDe(a, clave);
    return t ? <span className="cv-txt" title={t}>{t}</span> : <span className="cv-mute">—</span>;
}
