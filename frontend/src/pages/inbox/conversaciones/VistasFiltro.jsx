// Las vistas del Filtro (ADR-W247; desde ADR-W254, la sección «Rápidos y guardados»): una tarjeta por vista, con su
// ícono, cuántas hay y qué es. `cuales`: 'rapidos' (las predefinidas) o 'guardados' (las de cada uno, ★, con × para
// borrarlas).
import { AlarmClock, Clock, Flame, Hourglass, Inbox, Link2, Sparkles, Star, TimerOff, User, UserX, X } from 'lucide-react';
import { contar } from './colas';
import { igual, predefinidos } from './filtros';
import { useGuardados } from './guardados';

const ICONOS = {
    todos: Inbox, mios_esperan: Clock, mios_hora: Flame, mios_cierre: TimerOff, mios_toca: AlarmClock, mios_recientes: Sparkles,
    mios_dolor: Hourglass, mios_link: Link2, mios: User, sin_asignar: UserX,
};
const COLORES = {
    todos: 'var(--info)', mios_esperan: 'var(--brand-secondary)', mios_hora: 'var(--error)', mios_cierre: 'var(--error)', mios_toca: 'var(--warning)',
    mios_recientes: '#8B5CF6', mios_dolor: '#7D63E6', mios_link: 'var(--brand-secondary)', mios: 'var(--success)', sin_asignar: 'var(--warning)',
};

// La vista que coincide con el filtro puesto, o null (filtro a medida).
export function vistaActual(filtro, yo, guardados) {
    return [...predefinidos(yo), ...guardados].find((g) => igual(g.filtro, filtro)) || null;
}

export default function VistasFiltro({ cuales = 'rapidos', lista, filtro, onCambiar, ahora, yo, vacio }) {
    const guardados = useGuardados();
    const propias = cuales === 'guardados';
    const todas = propias ? guardados.lista : predefinidos(yo);
    if (!todas.length) return vacio ? <p className="t-cap mut">{vacio}</p> : null;
    return (
        <div className="cv-vistas" role="radiogroup" aria-label={propias ? 'Filtros guardados' : 'Filtros rápidos'}>
            {todas.map((g, i) => {
                const Icono = propias ? Star : ICONOS[g.id] || Inbox;
                const on = igual(g.filtro, filtro);
                return (
                    <button key={g.id} type="button" role="radio" aria-checked={on} className={`cv-vista${on ? ' cv-vista--on' : ''}`}
                        style={{ '--c': propias ? 'var(--warning)' : COLORES[g.id], '--i': i }} onClick={() => onCambiar({ ...g.filtro })}>
                        <span className="cv-vista-ico"><Icono size={14} aria-hidden="true" /></span>
                        <b>{contar(lista, { ...g.filtro, ahora })}</b>
                        <span className="cv-vista-t">{g.label}</span>
                        {g.detalle && <span className="cv-vista-d">{g.detalle}</span>}
                        {propias && (
                            <span role="button" tabIndex={0} className="cv-vista-x" aria-label={`Borrar «${g.label}»`}
                                onClick={(e) => { e.stopPropagation(); guardados.borrar(g.id); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); guardados.borrar(g.id); } }}><X size={11} /></span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
