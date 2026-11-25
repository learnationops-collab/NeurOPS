// El riel derecho del Workspace (25/11/2026): debajo del siguiente lead, cómo va la sección (la barra por
// etapa en Confirmar), lo que queda hoy en cada sección y las próximas llamadas. Todo se toca: las
// secciones llevan a su pestaña y cada llamada abre su ficha.
import { CalendarCheck, ChevronRight, ClipboardCheck, Flame, MessageCircle, Zap } from 'lucide-react';
import { formatCountdown } from '../../../utils/datetime';
import { ETAPAS_CONFIRMACION, etapaDeConfirmacion } from '../confirmar/etapas';
import { cuandoEs } from '../confirmar/propiedades';
import '../confirmar/confirmar.css';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function Progreso({ titulo, hechas, total, detalle, tramos }) {
    const pct = total ? Math.round((hechas / total) * 100) : 0;
    return (
        <section className="rail-sec">
            <h3 className="rail-h">{titulo}</h3>
            <p className="rail-cifra"><b>{hechas}</b><span>de {total}</span><em>{pct}%</em></p>
            <div className="rail-barra" role="img" aria-label={`${hechas} de ${total}`}>
                {(tramos || [{ k: 'hechas', n: hechas, c: 'var(--cl-magenta, #FF3FA4)' }]).map((t, i) => (
                    t.n > 0 && <i key={t.k} style={{ flexGrow: t.n, '--c': t.c, animationDelay: `${i * 80}ms` }} title={`${t.titulo || ''} ${t.n}`.trim()} />
                ))}
            </div>
            {tramos ? (
                <ul className="rail-leyenda">
                    {tramos.map(t => <li key={t.k} style={{ '--c': t.c }}><i aria-hidden="true" />{t.titulo}<b>{t.n}</b></li>)}
                </ul>
            ) : detalle && <p className="rail-nota">{detalle}</p>}
        </section>
    );
}

function Hoy({ filas, racha, xp, onIr }) {
    return (
        <section className="rail-sec">
            <h3 className="rail-h">Hoy</h3>
            <ul className="rail-hoy">
                {filas.map(f => (
                    <li key={f.k}>
                        <button type="button" className={f.n ? '' : 'rail-hoy--cero'} aria-current={f.activa || undefined} onClick={() => onIr(f.k)}>
                            <f.Icono aria-hidden="true" /><span>{f.titulo}</span><b>{f.n}</b><ChevronRight className="rail-flecha" aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>
            <div className="rail-logros">
                <span title="Días seguidos con el día cerrado"><Flame aria-hidden="true" />{plural(racha, 'día', 'días')}</span>
                <span title="Puntos de hoy"><Zap aria-hidden="true" />{xp} XP</span>
            </div>
        </section>
    );
}

function Proximas({ agendas, ahora, onAbrir }) {
    const lista = agendas
        .filter(a => a.start_time && cuandoEs(a).ms > ahora - 15 * 60000)
        .sort((x, y) => cuandoEs(x).ms - cuandoEs(y).ms)
        .slice(0, 5);
    if (!lista.length) return null;
    return (
        <section className="rail-sec">
            <h3 className="rail-h">Próximas llamadas</h3>
            <ol className="rail-prox">
                {lista.map(a => {
                    const e = ETAPAS_CONFIRMACION.find(x => x.clave === etapaDeConfirmacion(a));
                    const c = formatCountdown(a.start_time, ahora);
                    return (
                        <li key={a.id} style={{ '--c': e.color }}>
                            <button type="button" onClick={() => onAbrir(a)} title={`${a.lead_name || 'Sin nombre'} · ${e.titulo}`}>
                                <time>{cuandoEs(a).hora}</time>
                                <span className="rail-prox__n">{a.lead_name || 'Sin nombre'}</span>
                                <small>{c?.label || e.titulo}</small>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

/**
 * paso: 'confirmations' | 'calls' | 'seguimientos' | otro. agendas: la lista de la pestaña activa.
 * progreso: { titulo, hechas, total, detalle }. pendientes: { confirmations, calls, seguimientos }.
 */
export default function RailResumen({ paso, agendas, progreso, pendientes, racha, xp, ahora, onIr, onAbrir }) {
    const enConfirmar = paso === 'confirmations';
    const tramos = enConfirmar && agendas.length
        ? ETAPAS_CONFIRMACION.map(e => ({ k: e.clave, titulo: e.titulo, c: e.color, n: agendas.filter(a => etapaDeConfirmacion(a) === e.clave).length }))
        : null;
    const filas = [
        { k: 'confirmations', titulo: 'Por confirmar', Icono: CalendarCheck, n: pendientes.confirmations },
        { k: 'calls', titulo: 'Por reportar', Icono: ClipboardCheck, n: pendientes.calls },
        { k: 'seguimientos', titulo: 'Por seguir', Icono: MessageCircle, n: pendientes.seguimientos },
    ].map(f => ({ ...f, activa: f.k === paso }));
    return (
        <>
            {progreso && <Progreso {...progreso} tramos={tramos} />}
            <Hoy filas={filas} racha={racha} xp={xp} onIr={onIr} />
            {(enConfirmar || paso === 'calls') && <Proximas agendas={agendas} ahora={ahora} onAbrir={onAbrir} />}
        </>
    );
}
