// En qué va la conversación, en tres etapas: automática (el bot), manual (el setter) y agendamiento.
// El color y el ícono de cada punto dicen el estado; pausada (solo la automática) ya no se confunde con
// terminada. En la lista van como tres puntos; arriba del chat, grandes y con el detalle. Las reglas
// viven en el servidor (app/automatizaciones/progreso.py).
import { Bot, Calendar, Check, ChevronDown, MoreHorizontal, Pause, User, X } from 'lucide-react';
import { rotuloPaso } from '../estadoFlujo';
import MenuBot, { EJECUCION } from './AccionesFlujo';

export const ESTADOS = {
    pendiente: { color: 'var(--idle)', icono: null, texto: 'Pendiente' },
    progreso: { color: 'var(--info)', icono: MoreHorizontal, texto: 'En progreso' },
    completada: { color: 'var(--success)', icono: Check, texto: 'Completada' },
    fallida: { color: 'var(--error)', icono: X, texto: 'Fallida' },
    pausada: { color: 'var(--warning)', icono: Pause, texto: 'Pausada' },
};
const TRAMOS = [['auto', 'Automática', Bot], ['manual', 'Manual', User], ['agenda', 'Agendamiento', Calendar]];

export function Puntos({ etapas }) {
    if (!etapas) return null;
    const tip = TRAMOS.map(([t, l]) => `${l}: ${ESTADOS[etapas[t]]?.texto}`).join(' · ');
    return (
        <span className="cv-puntos" data-tip={`Etapas|${tip}`}>
            {TRAMOS.map(([t], i) => {
                const est = ESTADOS[etapas[t]] || ESTADOS.pendiente;
                const Icono = est.icono;
                return [
                    i > 0 && <i key={`l${t}`} className="cv-puntos-l" aria-hidden="true" />,
                    <span key={t} className={`cv-punto cv-punto--${etapas[t]}`} style={{ '--c': est.color }}>{Icono && <Icono size={10} strokeWidth={3} />}</span>,
                ];
            })}
        </span>
    );
}

function detalle(tramo, { avance, ejecucion, asignado, yo }) {
    const est = avance.etapas[tramo];
    if (tramo === 'auto') {
        if (!ejecucion) return 'Ningún flujo arrancó';
        const estado = est === 'pausada' ? 'bot en pausa' : (EJECUCION[ejecucion.estado]?.texto || ejecucion.estado).toLowerCase();
        return `${ejecucion.flujo} · ${ejecucion.paso ? rotuloPaso(ejecucion.paso) : estado}${ejecucion.paso ? ` · ${estado}` : ''}`;
    }
    if (tramo === 'manual') {
        if (est === 'pendiente') return asignado ? `Le toca a ${asignado.id === yo ? 'vos' : asignado.username}` : 'Sin asignar';
        return { progreso: 'Conversando', completada: 'Pasó a la agenda', fallida: 'Sin respuesta en 48 h' }[est];
    }
    if (est === 'completada') {
        return avance.agenda_en ? new Date(avance.agenda_en).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Agendó';
    }
    return est === 'progreso' ? 'Link enviado, sin agendar' : 'Sin link todavía';
}

// Arriba del chat. La automática es un botón: despliega las acciones del bot.
export function Tramos({ avance, ejecucion, contacto, asignado, yo, onCambio }) {
    if (!avance) return null;
    return (
        <div className="cv-tramos">
            {TRAMOS.map(([t, label, IconoTramo]) => {
                const est = ESTADOS[avance.etapas[t]] || ESTADOS.pendiente;
                const Icono = est.icono || IconoTramo;
                const cuerpo = (
                    <>
                        <span className="cv-tramo-p"><Icono size={12} strokeWidth={2.6} /></span>
                        <span className="cv-tramo-txt">
                            <b>{label} <em>{est.texto}</em></b>
                            <small>{detalle(t, { avance, ejecucion, asignado, yo })}</small>
                        </span>
                    </>
                );
                const clase = `cv-tramo cv-tramo--${avance.etapas[t]}`;
                if (t !== 'auto') return <div key={t} className={clase} style={{ '--c': est.color }}>{cuerpo}</div>;
                return (
                    <MenuBot key={t} contacto={contacto} ejecucion={ejecucion} onCambio={onCambio}
                        className={clase} style={{ '--c': est.color }}>
                        {cuerpo}<ChevronDown size={14} className="cv-tramo-caret" aria-hidden="true" />
                    </MenuBot>
                );
            })}
        </div>
    );
}
