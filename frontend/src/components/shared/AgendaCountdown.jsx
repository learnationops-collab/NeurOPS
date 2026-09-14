import React from 'react';
import useNow from '../../hooks/useNow';
import { formatCountdown } from '../../utils/datetime';
import AnimatedCounter from '../rare-ui/animated-counter';

// Cuenta regresiva viva hacia la hora de una agenda ("En 42:17", "Justo ahora", "Hace 3 horas y 15 minutos").
//
// Es un componente y no una función suelta a propósito: el reloj de un segundo vive ACÁ, en una
// hoja del árbol. Si el tick viviera en `CloserWorkflowPage` (5.000 líneas), cada segundo se
// re-renderizaría el workspace entero para mover dos dígitos. Así solo se repinta este <span>.
//
// El color no se decide acá: lo pone el padre, que ya sabe si la tarjeta está en una etapa
// donde el atraso importa. La precisión de segundos es para el TEXTO; el color cambia de
// categoría como mucho una vez por minuto.
//
// Cuando `formatCountdown` está en modo cronómetro (mm:ss / h:mm:ss -- los únicos formatos con
// dígitos que cambian cada segundo) se anima dígito por dígito en vez de texto plano. El resto
// de formatos ("En 3 días", "Hace 2 horas y 15 minutos") mezcla texto y números de forma
// irregular y sigue como `countdown.label` tal cual.
const isCronometro = (countdown, withSeconds) =>
    withSeconds && !countdown.isPast && countdown.kind !== 'now' && countdown.days === 0;

const AgendaCountdown = ({ startTime, withSeconds = true, fallback = null, className = '' }) => {
    const now = useNow(withSeconds ? 1000 : 30000);
    // `formatCountdown` ya decide solo cuándo los segundos aportan: los muestra para el tiempo
    // que falta por debajo de un día, y los omite para citas lejanas o ya pasadas.
    const countdown = formatCountdown(startTime, now, { withSeconds });
    if (!countdown) return fallback;

    if (!isCronometro(countdown, withSeconds)) {
        return <span className={className}>{countdown.label}</span>;
    }

    return (
        <span className={className}>
            En{' '}
            <span className="inline-flex items-baseline">
                {countdown.hours > 0 && (
                    <>
                        <AnimatedCounter value={countdown.hours} duration={0.4} />
                        <span>:</span>
                    </>
                )}
                <AnimatedCounter value={countdown.minutes} padStart={2} duration={0.4} />
                <span>:</span>
                <AnimatedCounter value={countdown.seconds} padStart={2} duration={0.4} />
            </span>
        </span>
    );
};

export default AgendaCountdown;
