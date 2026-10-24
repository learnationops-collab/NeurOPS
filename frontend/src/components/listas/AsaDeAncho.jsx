const PASO = 16;

/**
 * El borde derecho del encabezado de una columna `redimensionable`: se arrastra (mouse, dedo o lápiz) o,
 * con el foco, se mueve con las flechas; doble toque lo devuelve al ancho de la definición. Avisa el ancho
 * nuevo en px con `onAncho`; el que lo guarda y lo limita es `useAnchosColumnas`.
 */
const AsaDeAncho = ({ nombre, onAncho, onRestablecer }) => {
    const anchoActual = (e) => e.currentTarget.parentElement.getBoundingClientRect().width;

    const empezar = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const x0 = e.clientX;
        const ancho0 = anchoActual(e);
        const mover = (ev) => onAncho(ancho0 + ev.clientX - x0);
        const soltar = () => {
            window.removeEventListener('pointermove', mover);
            window.removeEventListener('pointerup', soltar);
            document.body.classList.remove('lc-redimensionando');
        };
        document.body.classList.add('lc-redimensionando');
        window.addEventListener('pointermove', mover);
        window.addEventListener('pointerup', soltar);
    };

    const teclas = (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation();
        onAncho(anchoActual(e) + (e.key === 'ArrowRight' ? PASO : -PASO));
    };

    return (
        <span className="lc-asa" role="separator" aria-orientation="vertical" tabIndex={0}
            aria-label={`Cambiar el ancho de ${nombre}`} title="Arrastrá para cambiar el ancho · doble toque para volver"
            onPointerDown={empezar} onKeyDown={teclas} onDoubleClick={onRestablecer} />
    );
};

export default AsaDeAncho;
