// Deja en la página `--ws-top` = el alto del header (que envuelve y cambia de alto): la barra de Confirmar
// y el riel derecho se pegan justo debajo.
import { useLayoutEffect } from 'react';

export function useAltoHeader(paginaRef) {
    useLayoutEffect(() => {
        const pagina = paginaRef.current;
        const header = pagina?.querySelector('header.top-v6');
        if (!header) return undefined;
        const medir = () => pagina.style.setProperty('--ws-top', header.offsetHeight + 'px');
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(header);
        return () => ro.disconnect();
    }, [paginaRef]);
}
