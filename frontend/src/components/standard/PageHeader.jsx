// Cabecera de página: título a la izquierda (con logo e insignias opcionales) y, a la derecha, las
// acciones de la sección. Cada sección manda sus botones y filtros con <HeaderActions>, que los lleva
// a la cabecera aunque la sección se dibuje más abajo en el árbol.

import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const DESTINO = 'tope-acc';

export function PageHeader({ title, logo, badges, actions }) {
    return (
        <header className="tope">
            <div className="tope-id">
                {logo}
                <h1 className="t-h1">{title}</h1>
                {badges}
            </div>
            <div className="tope-acc" id={DESTINO}>{actions}</div>
        </header>
    );
}

// `replaceTitle` esconde el título: para las barras que ya traen su «volver» (un evento o un
// formulario abiertos). Sin cabecera en la página (tests, otra pantalla) se dibuja en su lugar.
export function HeaderActions({ children, replaceTitle = false }) {
    const [destino, setDestino] = useState(undefined);
    useLayoutEffect(() => { setDestino(document.getElementById(DESTINO)); }, []);
    if (destino === undefined) return null;
    const el = <div className={'tope-barra' + (replaceTitle ? ' tope-barra--reemplaza' : '')}>{children}</div>;
    return destino ? createPortal(el, destino) : el;
}
