// Vista Semana de Confirmar (ADR-W201): las llamadas de la semana en el calendario estándar, coloreadas
// por etapa. Debajo de cada día, cuántas hay confirmadas. Tocar una abre la ficha.
import { Calendar, CalendarEvent, calendarY } from '../../../components/standard';
import { viewerTimezoneLabel } from '../../../utils/datetime';
import { ETAPAS_CONFIRMACION, etapaDeConfirmacion } from './etapas';
import { cuandoEs } from './propiedades';
import { textoDe } from './Celda';

const DESDE = 8, HASTA = 23, ALTO = 56, DURACION = 45;
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Los 7 días (lunes a domingo) de la semana de `base` corrida `offset` semanas, y su rótulo. */
export function semanaDe(base, offset = 0) {
    const d = new Date(base + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
    const dias = Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
    const mes = (x) => x.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    const [a, b] = [dias[0], dias[6]];
    const rotulo = a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${mes(b)}` : `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)}`;
    return { dias, rotulo };
}

// Dos llamadas que se pisan van una al lado de la otra.
function carriles(items) {
    const ord = [...items].sort((x, y) => x.minuto - y.minuto);
    const fin = [];
    ord.forEach(it => {
        let c = fin.findIndex(f => f <= it.minuto);
        if (c < 0) { c = fin.length; fin.push(0); }
        fin[c] = it.minuto + DURACION;
        it.carril = c;
    });
    ord.forEach(it => { it.de = 1 + Math.max(...ord.filter(o => Math.abs(o.minuto - it.minuto) < DURACION).map(o => o.carril)); });
    return ord;
}

export default function VistaSemana({ vista, agendas, semana, hoy, ahora, nombreCloser, seleccionada, onAbrir }) {
    const ahoraMin = (() => { const d = new Date(ahora); return d.getHours() * 60 + d.getMinutes(); })();
    const porDia = new Map();
    agendas.forEach(a => { const c = cuandoEs(a); if (!porDia.has(c.dia)) porDia.set(c.dia, []); porDia.get(c.dia).push({ a, minuto: c.minuto, hora: c.hora }); });
    const lineas = vista.props.filter(k => k !== 'hora').slice(0, 2);
    const days = semana.dias.map(d => {
        const k = iso(d), del = porDia.get(k) || [];
        const ok = del.filter(x => etapaDeConfirmacion(x.a) === 'confirmado').length;
        return { key: k, weekday: DIAS[d.getDay()], number: d.getDate(), today: k === hoy, caption: del.length ? `${ok}/${del.length} confirmadas` : '—' };
    });
    return (
        <div className="cv-semana">
            <Calendar days={days} startHour={DESDE} endHour={HASTA} hourHeight={ALTO} zoneLabel={viewerTimezoneLabel()} minWidth={860} nowMinutes={ahoraMin}
                renderColumn={(day) => carriles(porDia.get(day.key) || []).map(({ a, minuto, hora, carril, de }) => {
                    const etapa = ETAPAS_CONFIRMACION.find(e => e.clave === etapaDeConfirmacion(a));
                    const ancho = 100 / de;
                    const linea = lineas.map(k => textoDe(a, k, { nombreCloser })).filter(Boolean).join(' · ');
                    return (
                        <div key={a.id} role="button" tabIndex={0} onClick={() => onAbrir(a)} onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(a); }}>
                            <CalendarEvent className={`cv-ev${seleccionada === a.id ? ' cv-ev--sel' : ''}`}
                                style={{ '--c': etapa.color, left: `calc(${carril * ancho}% + 2px)`, right: 'auto', width: `calc(${ancho}% - 4px)` }}
                                top={calendarY(Math.min(Math.max(minuto, DESDE * 60), HASTA * 60 - DURACION), DESDE, ALTO)} height={DURACION / 60 * ALTO - 2}
                                title={`${hora} ${a.lead_name || 'Sin nombre'}`} line={linea || null} tooltip={`${a.lead_name} · ${etapa.titulo}`} />
                        </div>
                    );
                })} />
        </div>
    );
}
