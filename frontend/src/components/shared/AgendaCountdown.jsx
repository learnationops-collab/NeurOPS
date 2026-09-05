import React from 'react';
import useNow from '../../hooks/useNow';
import { formatCountdown } from '../../utils/datetime';

// Cuenta regresiva viva hacia la hora de una agenda ("En 42:17", "Ahora mismo", "Hace 3 h").
//
// Es un componente y no una función suelta a propósito: el reloj de un segundo vive ACÁ, en una
// hoja del árbol. Si el tick viviera en `CloserWorkflowPage` (5.000 líneas), cada segundo se
// re-renderizaría el workspace entero para mover dos dígitos. Así solo se repinta este <span>.
//
// El color no se decide acá: lo pone el padre, que ya sabe si la tarjeta está en una etapa
// donde el atraso importa. La precisión de segundos es para el TEXTO; el color cambia de
// categoría como mucho una vez por minuto.
const AgendaCountdown = ({ startTime, withSeconds = true, fallback = null, className = '' }) => {
    const now = useNow(withSeconds ? 1000 : 30000);
    // `formatCountdown` ya decide solo cuándo los segundos aportan: los muestra para el tiempo
    // que falta por debajo de un día, y los omite para citas lejanas o ya pasadas.
    const countdown = formatCountdown(startTime, now, { withSeconds });
    if (!countdown) return fallback;

    return <span className={className}>{countdown.label}</span>;
};

export default AgendaCountdown;
