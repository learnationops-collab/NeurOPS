// Las vistas del Filtro (ADR-W247; antes el desplegable «Míos sin respuesta» y los chips de arriba de la lista): una
// tarjeta por vista, con su ícono y cuántas hay. Las predefinidas y las que guardó cada uno (★, con × para borrarlas).
import { Clock, Inbox, Sparkles, Star, User, UserX, X } from 'lucide-react';
import { filtrar } from './colas';
import { igual, predefinidos } from './filtros';
import { useGuardados } from './guardados';

const ICONOS = { todos: Inbox, mios_recientes: Sparkles, mios_esperan: Clock, mios: User, sin_asignar: UserX };
const COLORES = { todos: 'var(--info)', mios_recientes: '#8B5CF6', mios_esperan: 'var(--brand-secondary)', mios: 'var(--success)', sin_asignar: 'var(--warning)' };

// La vista que coincide con el filtro puesto, o null (filtro a medida).
export function vistaActual(filtro, yo, guardados) {
    return [...predefinidos(yo), ...guardados].find((g) => igual(g.filtro, filtro)) || null;
}

export default function VistasFiltro({ lista, filtro, onCambiar, ahora, yo }) {
    const guardados = useGuardados();
    const todas = [...predefinidos(yo), ...guardados.lista];
    return (
        <div className="cv-vistas" role="radiogroup" aria-label="Vistas">
            {todas.map((g, i) => {
                const propia = guardados.lista.includes(g);
                const Icono = propia ? Star : ICONOS[g.id] || Inbox;
                const on = igual(g.filtro, filtro);
                return (
                    <button key={g.id} type="button" role="radio" aria-checked={on} className={`cv-vista${on ? ' cv-vista--on' : ''}`}
                        style={{ '--c': propia ? 'var(--warning)' : COLORES[g.id], '--i': i }} onClick={() => onCambiar({ ...g.filtro })}>
                        <span className="cv-vista-ico"><Icono size={14} aria-hidden="true" /></span>
                        <b>{filtrar(lista, { ...g.filtro, ahora }).length}</b>
                        <span className="cv-vista-t">{g.label}</span>
                        {propia && (
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
