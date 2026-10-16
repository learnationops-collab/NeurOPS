// Calendario de horas (semana o día): fila de días, eje de horas, columnas y línea de «ahora». No sabe
// qué muestra: cada pantalla pone el contenido de cada columna (renderColumn), ubicado con calendarY.
// CalendarEvent es la tarjeta de un evento, al estilo de Google Calendar.

import clsx from 'clsx';
import './standard.css';

const pad2 = (n) => String(n).padStart(2, '0');

// Posición vertical (px) de un minuto del día dentro de la grilla.
export const calendarY = (minutes, startHour, hourHeight) => (minutes - startHour * 60) / 60 * hourHeight;

/**
 * days: [{ key, weekday, number, today, caption, extra }]: `caption` va debajo del número (por ejemplo,
 * «3 libres») y `extra`, al final de la cabecera del día (por ejemplo, los carriles de un día).
 * renderColumn(day, i): lo que va en la columna. columnProps(day, i): atributos de la columna (onPointerDown…).
 * nowMinutes: minuto del día de «ahora»; la línea se dibuja en la columna de hoy si cae en la grilla.
 */
export function Calendar({ days, startHour, endHour, hourHeight, zoneLabel, minWidth, nowMinutes, renderColumn, columnProps, className }) {
    const columnas = 'repeat(' + days.length + ',minmax(0,1fr))';
    const verAhora = nowMinutes != null && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;
    return (
        <div className={clsx('ui-cal', className)}>
            <div className="ui-cal__head" style={{ minWidth, gridTemplateColumns: '56px ' + columnas }}>
                <span className="ui-cal__zone">{zoneLabel}</span>
                {days.map(d => (
                    <div key={d.key} className={clsx('ui-cal__day', d.today && 'ui-cal__day--today')}>
                        <span>{d.weekday}</span><b>{d.number}</b>
                        {d.caption !== undefined && <em>{d.caption}</em>}
                        {d.extra}
                    </div>
                ))}
            </div>
            <div className="ui-cal__body" style={{ height: (endHour - startHour) * hourHeight, minWidth }}>
                <div className="ui-cal__hours">
                    {Array.from({ length: endHour - startHour }, (_, i) => <span key={i} style={{ top: i * hourHeight }}>{pad2(startHour + i)}:00</span>)}
                </div>
                <div className="ui-cal__grid" style={{ '--hpx': hourHeight + 'px', gridTemplateColumns: columnas }}>
                    {days.map((d, i) => (
                        <div key={d.key} className={clsx('ui-cal__col', d.today && 'ui-cal__col--today')} {...(columnProps ? columnProps(d, i) : null)}>
                            {renderColumn(d, i)}
                            {d.today && verAhora && <div className="ui-cal__now" style={{ top: calendarY(nowMinutes, startHour, hourHeight) }} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Tarjeta de un evento. Muestra lo que entra según el alto: el título (y el ícono) desde 15 px, la línea
 * de abajo desde 27 y la hora desde 32 (41 si hay línea). `style` trae la posición horizontal cuando se
 * pisa con otras (lado a lado o encimadas); `className`, el tono que le da la pantalla; `marker`, un punto
 * de color antes del título (de quién es).
 */
export function CalendarEvent({ top, height, icon, marker, title, line = null, time, sub, tooltip, className, style }) {
    return (
        <div className={clsx('ui-cal-event', className)} style={{ top, height, ...style }} data-tip={tooltip}>
            {height >= 15 && (
                <span className="ui-cal-event__head">
                    {icon && <span className="ui-cal-event__icon">{icon}</span>}
                    {marker}
                    <b className="ui-cal-event__title">{title}</b>
                </span>
            )}
            {height >= 27 && line && <span className="ui-cal-event__line">{line}</span>}
            {height >= (line ? 41 : 32) && time && <span className="ui-cal-event__time">{time}{sub ? ' · ' + sub : ''}</span>}
        </div>
    );
}
