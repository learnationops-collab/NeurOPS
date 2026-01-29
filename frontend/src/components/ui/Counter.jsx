import { useEffect, useState, useRef } from 'react';

const easeOutExpo = (x) => {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

const Counter = ({ value, duration = 2000, prefix = "", suffix = "" }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const startTime = useRef(null);
    const startValue = useRef(0);
    const requestRef = useRef(null);

    useEffect(() => {
        startValue.current = displayValue;
        startTime.current = null;

        // Si el valor no es numérico, lo mostramos directamente
        if (typeof value !== 'number') {
            setDisplayValue(value);
            return;
        }

        const animate = (time) => {
            if (!startTime.current) startTime.current = time;
            const progress = (time - startTime.current) / duration;

            if (progress < 1) {
                const ease = easeOutExpo(progress);
                const nextValue = startValue.current + (value - startValue.current) * ease;
                setDisplayValue(nextValue);
                requestRef.current = requestAnimationFrame(animate);
            } else {
                setDisplayValue(value);
            }
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(requestRef.current);
    }, [value, duration]);

    // Formato: Sin decimales si es entero, max 2 si no.
    // Ajuste para KPIs grandes: integer
    const formatted = typeof displayValue === 'number'
        ? displayValue.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : displayValue;

    return <span>{prefix}{formatted}{suffix}</span>;
}

export default Counter;
