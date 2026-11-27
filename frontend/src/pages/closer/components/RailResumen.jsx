// El riel derecho del Workspace (25/11/2026): cómo va la sección (la barra por etapa en Confirmar) y lo que
// queda hoy en cada sección, que lleva a su pestaña.
import { CalendarCheck, ChevronRight, ClipboardCheck, Flame, MessageCircle, Zap } from 'lucide-react';
import { ETAPAS_CONFIRMACION, etapaDeConfirmacion } from '../confirmar/etapas';
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

/**
 * paso: 'confirmations' | 'calls' | 'seguimientos' | otro. agendas: la lista de la pestaña activa.
 * progreso: { titulo, hechas, total, detalle }. pendientes: { confirmations, calls, seguimientos }.
 */
export default function RailResumen({ paso, agendas, progreso, pendientes, racha, xp, onIr }) {
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
        </>
    );
}
