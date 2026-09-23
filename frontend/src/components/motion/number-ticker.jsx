import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Cifra que cuenta hasta su valor.
 *
 * Existe porque el gráfico de embudo de beui.dev la importa desde `@/components/motion/
 * number-ticker`. El repo ya tiene `components/ui/Counter.jsx`, pero con otra API (duración en
 * ms, sin `format` ni `startOnView`), y cambiarla tocaría las pantallas que ya la usan — así que
 * esto es un componente aparte con la API que el gráfico espera.
 *
 * Con `prefers-reduced-motion` no cuenta: muestra el valor final de una.
 */
const NumberTicker = ({
    value = 0,
    format,
    prefix = '',
    suffix = '',
    duration = 0.4,
    startOnView = true,
    className,
}) => {
    const reducido = useReducedMotion();
    const [actual, setActual] = useState(() => (startOnView && !reducido ? 0 : value));
    const [visible, setVisible] = useState(!startOnView);
    const ref = useRef(null);
    const desde = useRef(actual);
    const raf = useRef(null);

    // Con `startOnView` la cuenta arranca cuando la cifra entra en pantalla, no al montar: en un
    // panel que está más abajo, animar antes de que se vea es animar para nadie.
    useEffect(() => {
        if (!startOnView || visible || !ref.current) return undefined;
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
                setVisible(true);
                obs.disconnect();
            }
        }, { threshold: 0.2 });
        obs.observe(ref.current);
        return () => obs.disconnect();
    }, [startOnView, visible]);

    useEffect(() => {
        if (!visible) return undefined;
        if (reducido || duration <= 0) {
            setActual(value);
            return undefined;
        }
        const inicio = performance.now();
        const arranca = desde.current;
        const salto = value - arranca;
        const ms = duration * 1000;

        const tick = (ahora) => {
            const t = Math.min(1, (ahora - inicio) / ms);
            // Ease out cúbica: la misma sensación que EASE_OUT, sin depender de motion acá.
            const e = 1 - Math.pow(1 - t, 3);
            setActual(arranca + salto * e);
            if (t < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => {
            if (raf.current) cancelAnimationFrame(raf.current);
            desde.current = value;
        };
    }, [value, visible, reducido, duration]);

    const texto = format ? format(actual) : Math.round(actual).toLocaleString('en-US');

    return (
        <span ref={ref} className={className}>
            {prefix}{texto}{suffix}
        </span>
    );
};

export default NumberTicker;
export { NumberTicker };
