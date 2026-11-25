// Vista Calendario de Confirmar (ADR-W201, 25/11/2026): las llamadas de 1 a 9 días en el calendario
// estándar. Cada llamada dice su etapa con texto y las propiedades que la vista tiene prendidas (tipo,
// closer, decisión, inversión…). La cabecera de días queda pegada al scrollear. Tocar una abre la ficha.
import { useLayoutEffect, useRef } from 'react';
import { DollarSign, PhoneCall, UserCheck, Users } from 'lucide-react';
import { Calendar, CalendarEvent, calendarY } from '../../../components/standard';
import { viewerTimezoneLabel } from '../../../utils/datetime';
import { ETAPAS_CONFIRMACION, etapaDeConfirmacion } from './etapas';
import { cuandoEs, decisorCorto, inversionCorta, inversionDe, tipoDe } from './propiedades';
import { TONO_SEGMENTO, TONO_TIPO, textoDe } from './Celda';

const DURACION = 45;
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const PREFIJO = { decision: 'Decide', inversion: 'Invierte', ingresos: 'Ingresos', examen: 'Examen', origen: 'Origen', telefono: 'Tel' };
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const corto = (t, n = 26) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

/** Los días a la vista: la semana (lunes a domingo) o de 1 a 9 días desde `base`, corridos `offset` períodos. */
export function periodoDe(base, offset = 0, dias = 7) {
    const d = new Date(base + 'T12:00:00');
    if (dias === 7) d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setDate(d.getDate() + offset * dias);
    const lista = Array.from({ length: dias }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
    const mes = (x) => x.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    const [a, b] = [lista[0], lista[lista.length - 1]];
    const rotulo = dias === 1
        ? a.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' }) + ' ' + mes(a)
        : a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${mes(b)}` : `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)}`;
    return { dias: lista, rotulo };
}

// Las que se pisan: si empiezan a distinta hora se escalonan (se lee el comienzo de cada una, como en
// Google Calendar); si empiezan juntas, van lado a lado.
function ubicar(items) {
    const ord = [...items].sort((x, y) => x.minuto - y.minuto);
    let grupo = [], fin = -1;
    const cerrar = () => {
        const carriles = [];
        grupo.forEach(it => {
            let c = carriles.findIndex(f => f <= it.minuto);
            if (c < 0) { c = carriles.length; carriles.push(0); }
            carriles[c] = it.minuto + DURACION;
            it.carril = c;
        });
        const n = carriles.length;
        const juntas = new Set(grupo.map(g => g.minuto)).size < grupo.length;
        grupo.forEach(it => {
            if (n === 1) { it.izq = 0; it.ancho = 100; } else if (juntas) { it.ancho = 100 / n; it.izq = it.carril * it.ancho; } else {
                const paso = Math.min(24, 60 / (n - 1));
                it.izq = it.carril * paso; it.ancho = 100 - it.izq;
            }
        });
        grupo = [];
    };
    ord.forEach(it => {
        if (grupo.length && it.minuto >= fin) cerrar();
        grupo.push(it);
        fin = Math.max(fin, it.minuto + DURACION);
    });
    if (grupo.length) cerrar();
    return ord;
}

const VERDE = 'var(--cl-success, #2FBF8F)', AMBAR = 'var(--cl-warning, #D9A441)', ROJO = 'var(--ui-danger, #f87171)';

// Una etiqueta por propiedad prendida, cada una con su color y su ícono.
function chipsDe(a, claves, ctx) {
    const out = [];
    claves.forEach(k => {
        if (k === 'etapa') {
            const e = ETAPAS_CONFIRMACION.find(x => x.clave === etapaDeConfirmacion(a));
            out.push({ k, c: e.color, icono: <b className={`cv-punto${e.clave === 'por_contactar' ? ' cv-punto--late' : ''}`} />, t: e.titulo, fuerte: true });
        } else if (k === 'segmento') {
            if (a.segmento) out.push({ k, c: TONO_SEGMENTO[a.segmento], t: a.segmento_puntos != null ? `${a.segmento} · ${Number(a.segmento_puntos) > 0 ? '+' : ''}${Number(a.segmento_puntos).toLocaleString('es-AR', { maximumFractionDigits: 1 })}` : a.segmento, fuerte: true, title: 'Segmento' });
        } else if (k === 'inversion') {
            const txt = inversionDe(a);
            if (txt) { const v = inversionCorta(txt); out.push({ k, c: v.sin ? ROJO : VERDE, icono: <DollarSign />, t: v.texto.replace(' USD', ''), title: txt }); }
        } else if (k === 'decision') {
            const d = decisorCorto(a);
            if (d) out.push({ k, c: d.solo === false ? AMBAR : d.solo ? VERDE : 'var(--cl-info, #4E8BD8)', icono: d.solo ? <UserCheck /> : <Users />, t: d.texto, title: d.title });
        } else if (k === 'tipo') {
            const t = tipoDe(a, ctx);
            out.push({ k, c: TONO_TIPO[t.clave], icono: <PhoneCall />, t: t.titulo });
        } else if (k === 'closer') {
            const n = textoDe(a, k, ctx);
            if (n) out.push({ k, c: 'var(--cl-lila, #7D8BFF)', icono: <i className="cv-ini">{n.trim()[0]}</i>, t: n.split(' ')[0], title: n });
        } else {
            const t = textoDe(a, k, ctx);
            if (t) out.push({ k, neutro: true, pre: PREFIJO[k], t: corto(t), title: t });
        }
    });
    return out;
}

function Chips({ lista }) {
    return lista.map((x) => (
        <i key={x.k} className={`cv-chip${x.neutro ? ' cv-chip--neutro' : ''}${x.fuerte ? ' cv-chip--fuerte' : ''}`}
            style={{ '--c': x.c }} title={x.title}>
            {x.icono}{x.pre && <small>{x.pre}</small>}{x.t}
        </i>
    ));
}

export default function VistaCalendario({ vista, agendas, periodo, hoy, ahora, nombreCloser, catalogo, userId, esTriage, seleccionada, onAbrir }) {
    const caja = useRef(null);
    const alto = vista.alto || 104;
    const nDias = periodo.dias.length;
    const ahoraMin = (() => { const d = new Date(ahora); return d.getHours() * 60 + d.getMinutes(); })();
    const ctx = { nombreCloser, userId, esTriage };

    const porDia = new Map();
    agendas.forEach(a => { const c = cuandoEs(a); if (!porDia.has(c.dia)) porDia.set(c.dia, []); porDia.get(c.dia).push({ a, minuto: c.minuto, hora: c.hora }); });
    const claves = periodo.dias.map(iso);
    const visibles = claves.flatMap(k => porDia.get(k) || []);
    const minutos = visibles.map(x => x.minuto);
    const desde = Math.max(0, Math.min(8, Math.floor(Math.min(...minutos, 8 * 60) / 60)));
    const hasta = Math.min(24, Math.max(21, Math.ceil((Math.max(...minutos, 0) + DURACION) / 60)));
    const props = vista.props.filter(k => k !== 'hora' && catalogo.some(p => p.clave === k));

    const days = periodo.dias.map((d, i) => {
        const k = claves[i], del = porDia.get(k) || [];
        const ok = del.filter(x => etapaDeConfirmacion(x.a) === 'confirmado').length;
        const caption = !del.length ? 'sin llamadas' : nDias <= 3 ? `${ok} de ${del.length} confirmadas` : `${ok}/${del.length} confirmadas`;
        return { key: k, weekday: DIAS[d.getDay()], number: d.getDate(), today: k === hoy, caption, finde: d.getDay() % 6 === 0 };
    });

    // Al cambiar de período o de zoom, arranca una hora antes de ahora (si hoy está a la vista) o de la primera llamada.
    const primera = visibles.length ? Math.min(...minutos) : null;
    const hoyVisible = claves.includes(hoy);
    useLayoutEffect(() => {
        if (!caja.current) return;
        const objetivo = hoyVisible ? ahoraMin - 60 : primera != null ? primera - 30 : 9 * 60;
        caja.current.scrollTop = Math.max(0, calendarY(objetivo, desde, alto));
    }, [periodo.rotulo, alto, nDias]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div ref={caja} className={`cv-semana cv-cal cv-cal--d${nDias}${nDias >= 5 ? ' cv-cal--angosto' : ''}`}>
            <Calendar days={days} startHour={desde} endHour={hasta} hourHeight={alto} zoneLabel={viewerTimezoneLabel()} minWidth={nDias >= 5 ? 860 : 0}
                nowMinutes={ahoraMin}
                columnProps={(day) => ({ 'data-finde': day.finde || undefined })}
                renderColumn={(day) => ubicar(porDia.get(day.key) || []).map(({ a, minuto, hora, izq, ancho, carril }) => {
                    const etapa = ETAPAS_CONFIRMACION.find(e => e.clave === etapaDeConfirmacion(a));
                    const pasada = cuandoEs(a).ms + DURACION * 60000 < ahora;
                    const detalle = [etapa.titulo, ...props.filter(k => k !== 'etapa').map(k => {
                        const t = textoDe(a, k, ctx);
                        return t && (PREFIJO[k] ? `${PREFIJO[k]}: ${t}` : t);
                    })].filter(Boolean).join(' · ');
                    return (
                        <div key={a.id} role="button" tabIndex={0} aria-label={`${hora} ${a.lead_name || 'Sin nombre'}, ${etapa.titulo}`}
                            onClick={() => onAbrir(a)} onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(a); }}>
                            <CalendarEvent
                                className={`cv-ev${seleccionada === a.id ? ' cv-ev--sel' : ''}${pasada ? ' cv-ev--pasada' : ''}`}
                                style={{ '--c': etapa.color, '--h': `${DURACION / 60 * alto - 3}px`, left: `calc(${izq}% + 3px)`, right: 'auto', width: `calc(${ancho}% - 6px)`, zIndex: 1 + carril }}
                                top={calendarY(Math.min(Math.max(minuto, desde * 60), hasta * 60 - DURACION), desde, alto) + 1}
                                height={DURACION / 60 * alto - 3}
                                title={<><span className="cv-ev__h">{hora}</span>{a.lead_name || 'Sin nombre'}</>}
                                line={<span className="cv-ev__chips"><Chips lista={chipsDe(a, props, ctx)} /></span>}
                                tooltip={`${a.lead_name || 'Sin nombre'} · ${hora}|${detalle}`} />
                        </div>
                    );
                })} />
        </div>
    );
}
