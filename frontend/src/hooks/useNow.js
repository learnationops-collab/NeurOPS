import { useEffect, useState } from 'react';

// Reloj vivo compartido por toda la app.
//
// Por qué un solo intervalo y no uno por componente: el contador de cada tarjeta del Kanban
// necesita re-renderizarse cada segundo, y el mazo puede tener 30 tarjetas a la vez. Treinta
// `setInterval` desincronizados hacen que los segundos de las tarjetas cambien en momentos
// distintos (se ve como un parpadeo desordenado) y multiplican el trabajo del navegador.
// Acá hay un único timer y los componentes se suscriben.
//
// Se apaga cuando la pestaña queda oculta (no tiene sentido contar contra una vista que nadie
// mira) y al volver dispara un tick inmediato, así el número ya está al día en el primer frame.

const subscribers = new Set();
let timerId = null;

function tick() {
    const now = Date.now();
    subscribers.forEach((sub) => {
        if (now - sub.last >= sub.intervalMs) {
            sub.last = now;
            sub.setNow(now);
        }
    });
}

function start() {
    if (timerId || typeof document === 'undefined' || document.hidden) return;
    timerId = setInterval(tick, 1000);
}

function stop() {
    if (!timerId) return;
    clearInterval(timerId);
    timerId = null;
}

function onVisibilityChange() {
    if (document.hidden) {
        stop();
        return;
    }
    // Volver a la pestaña tiene que mostrar el número correcto ya, no dentro de un segundo.
    subscribers.forEach((sub) => { sub.last = 0; });
    tick();
    if (subscribers.size) start();
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
}

// `intervalMs` es cada cuánto quiere despertarse ESE componente (1s para un cronómetro con
// segundos, 30s para algo que solo cambia de minuto). El timer global igual late cada segundo.
export default function useNow(intervalMs = 1000) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const sub = { setNow, intervalMs, last: Date.now() };
        subscribers.add(sub);
        start();
        return () => {
            subscribers.delete(sub);
            if (!subscribers.size) stop();
        };
    }, [intervalMs]);

    return now;
}
