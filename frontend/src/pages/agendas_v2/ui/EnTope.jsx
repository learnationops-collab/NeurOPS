// Lo que va en la fila del título de la página (#tope-acc en ThalamusApp): botones y filtros de la
// sección a la derecha del título, el contenido debajo. `reemplaza` esconde el título (para las
// barras que ya traen su «volver», como el evento o el formulario abiertos).
// Sin #tope-acc (tests, otra pantalla) se dibuja en su lugar.

import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function EnTope({ children, reemplaza = false }) {
    const [destino, setDestino] = useState(undefined);
    useLayoutEffect(() => { setDestino(document.getElementById('tope-acc')); }, []);
    if (destino === undefined) return null;
    const el = <div className={'tope-barra' + (reemplaza ? ' tope-barra--reemplaza' : '')}>{children}</div>;
    return destino ? createPortal(el, destino) : el;
}
