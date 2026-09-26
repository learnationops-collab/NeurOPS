import { useReducedMotion } from 'framer-motion';

/**
 * Movimiento de la ficha, en un solo lugar.
 *
 * Dos reglas detrás de estos números:
 *
 * · **Solo entrada, sin salida.** Los paneles y los popovers se animan al aparecer
 *   y desaparecen de golpe. Una animación de salida obliga a `AnimatePresence` y a
 *   dejar el elemento viejo en el DOM mientras se va: en un panel de pestañas eso
 *   significa que durante 200 ms hay dos pestañas montadas, con dos formularios y
 *   dos focos posibles. No vale la pena por un fundido de salida que nadie mira.
 *
 * · **`prefers-reduced-motion` no es una animación más lenta, es ninguna.** Con la
 *   preferencia activa se devuelve duración 0 y sin desplazamiento: el contenido
 *   aparece donde va a quedar.
 */
const SUAVE = [0.22, 0.7, 0.2, 1];   // el mismo `--crecer` del design system

export const useMovimiento = () => {
    const quieto = useReducedMotion();

    return {
        quieto: !!quieto,

        /** Panel de pestaña: entra con un empujón hacia arriba, casi imperceptible. */
        panel: quieto
            ? { initial: false, animate: { opacity: 1, y: 0 } }
            : {
                initial: { opacity: 0, y: 8 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.26, ease: SUAVE },
            },

        /** Sub-vista: entra desde el costado, como si el panel se corriera. */
        subvista: quieto
            ? { initial: false, animate: { opacity: 1, x: 0 } }
            : {
                initial: { opacity: 0, x: 14 },
                animate: { opacity: 1, x: 0 },
                transition: { duration: 0.24, ease: SUAVE },
            },

        /** Popover: crece desde su borde superior, anclado al disparador. */
        popover: quieto
            ? { initial: false, animate: { opacity: 1, scale: 1, y: 0 } }
            : {
                initial: { opacity: 0, scale: 0.97, y: -6 },
                animate: { opacity: 1, scale: 1, y: 0 },
                transition: { duration: 0.16, ease: SUAVE },
                style: { transformOrigin: 'top center' },
            },

        /** El subrayado del tablist viaja de pestaña a pestaña en vez de saltar. */
        subrayado: quieto
            ? {}
            : { layout: true, transition: { type: 'spring', bounce: 0.2, duration: 0.42 } },
    };
};

export default useMovimiento;
