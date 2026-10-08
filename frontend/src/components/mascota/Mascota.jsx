import { useEffect, useRef, useState } from 'react';
import { hojasDe } from './mascotas';

/**
 * Un personaje que mira hacia el cursor y reacciona cuando lo tocan: el avatar del menú de sesión.
 *
 * Adaptado de `Mascot` de page-mascot (https://github.com/nilbuild/page-mascot, MIT © Kamran Ahmed).
 * Lo de él: las dos hojas de 3×3 (nueve direcciones, nueve gestos), elegir la celda por el ángulo
 * del cursor con histéresis y zona muerta, y el «boop» (parpadeo, un gesto, mareado al cuarto toque
 * seguido, el aplaste que respeta `prefers-reduced-motion`). Lo que cambia acá:
 *
 * - Es un `<span>` decorativo y no un `<button>`: el del dock vive DENTRO del botón del menú, y un
 *   botón adentro de otro no es HTML válido. Quien lo usa pone el botón y su nombre.
 * - Reacciona cuando cambia `toques` (lo sube quien lo contiene al hacer clic), no con su propio clic.
 * - La zona muerta es la mitad del tamaño (en el original, 70 px para 140): a 40 px, 70 dejaba al
 *   personaje mirando al frente con el cursor ya encima de las opciones del menú.
 */
const DIRECCIONES = ['up-left', 'up', 'up-right', 'left', 'center', 'right', 'down-left', 'down', 'down-right'];
const REACCIONES = ['blink', 'heart', 'sparkle', 'surprised', 'wink', 'bashful', 'sleepy', 'dizzy', 'delighted'];
// En el sentido de las agujas del reloj desde la derecha, como atan2 con la y hacia abajo.
const EN_RONDA = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
const SECTOR = (Math.PI * 2) / EN_RONDA.length;
const HISTERESIS = 0.12;
const PREMIOS = ['heart', 'sparkle', 'delighted'];
const APLASTE = [
    { transform: 'scale(1, 1)', easing: 'ease-in' },
    { transform: 'scale(1.10, 0.86)', offset: 0.18, easing: 'ease-out' },
    { transform: 'scale(0.95, 1.08)', offset: 0.45, easing: 'ease-in-out' },
    { transform: 'scale(1.03, 0.97)', offset: 0.72, easing: 'ease-in-out' },
    { transform: 'scale(1, 1)' },
];

// background-size 300%: cada celda es un paso limpio de 0/50/100% en los dos ejes.
const celda = (i) => ({ backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%` });
const envolver = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const capa = { position: 'absolute', inset: 0, backgroundSize: '300% 300%', backgroundRepeat: 'no-repeat' };

const Mascota = ({ personaje, size = 40, toques = 0, className = '' }) => {
    const raiz = useRef(null);
    const aplaste = useRef(null);
    const timers = useRef([]);
    const seguidos = useRef({ cuenta: 0, en: 0 });
    const [direccion, setDireccion] = useState('center');
    const [reaccion, setReaccion] = useState(null);
    const { direcciones, reacciones } = hojasDe(personaje);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function'
            || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
        const zonaMuerta = size / 2;
        let sector = -1;
        let puntero = null;
        const apuntar = () => {
            const el = raiz.current;
            if (!el || !puntero) return;
            const caja = el.getBoundingClientRect();
            const dx = puntero.x - (caja.left + caja.width / 2);
            const dy = puntero.y - (caja.top + caja.height / 2);
            if (Math.hypot(dx, dy) < zonaMuerta) {
                sector = -1;
                setDireccion('center');
                return;
            }
            // Se queda en su sector hasta que el puntero pasa bien el borde.
            const angulo = Math.atan2(dy, dx);
            if (sector !== -1 && Math.abs(envolver(angulo - sector * SECTOR)) < SECTOR / 2 + HISTERESIS) return;
            sector = (Math.round(angulo / SECTOR) + EN_RONDA.length) % EN_RONDA.length;
            setDireccion(EN_RONDA[sector]);
        };
        const mover = (e) => { puntero = { x: e.clientX, y: e.clientY }; apuntar(); };
        window.addEventListener('pointermove', mover, { passive: true });
        window.addEventListener('scroll', apuntar, { passive: true });
        return () => {
            window.removeEventListener('pointermove', mover);
            window.removeEventListener('scroll', apuntar);
        };
    }, [size]);

    useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

    // Cada toque nuevo: parpadea y premia (un corazón, un brillo, encantado); al cuarto seguido, mareado.
    useEffect(() => {
        if (!toques) return;
        timers.current.forEach(window.clearTimeout);
        timers.current = [];
        const despues = (ms, r) => { timers.current.push(window.setTimeout(() => setReaccion(r), ms)); };
        const ahora = Date.now();
        const s = seguidos.current;
        s.cuenta = ahora - s.en < 1600 ? s.cuenta + 1 : 1;
        s.en = ahora;
        if (s.cuenta >= 4) {
            s.cuenta = 0;
            setReaccion('dizzy');
            despues(1100, null);
        } else {
            setReaccion('blink');
            despues(120, PREMIOS[(s.cuenta - 1) % PREMIOS.length]);
            despues(560, null);
        }
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        // Easing por cuadro y el efecto lineal: un easing en el efecto reinterpretaría cada offset.
        aplaste.current?.animate?.(APLASTE, { duration: 420, easing: 'linear' });
    }, [toques]);

    return (
        <span ref={raiz} className={`mascota ${className}`.trim()} data-mascota={personaje} aria-hidden="true"
            style={{ position: 'relative', display: 'block', flexShrink: 0, width: size, height: size }}>
            <span ref={aplaste}
                style={{ position: 'relative', display: 'block', width: '100%', height: '100%', transformOrigin: '50% 78%' }}>
                <span style={{ ...capa, backgroundImage: `url(${direcciones})`, ...celda(DIRECCIONES.indexOf(direccion)),
                    opacity: reaccion ? 0 : 1 }} />
                <span style={{ ...capa, backgroundImage: `url(${reacciones})`, ...celda(REACCIONES.indexOf(reaccion ?? 'blink')),
                    opacity: reaccion ? 1 : 0 }} />
            </span>
        </span>
    );
};

export default Mascota;
