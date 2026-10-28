import { useCallback } from 'react';
import { useVerRegistros } from '../../../../components/standard';
import ContenidoRegistros from './ContenidoRegistros';

const FUENTE = { setting: 'Setting', workshop: 'Workshop' };

/**
 * «Ver registros» de las cifras de Marketing: `abrir(fuente, metrica, titulo[, segmento, nombre])` abre el panel (lateral o
 * central) con la lista de lo que suma esa cifra en el período, y `panel` va una vez en el JSX de la pantalla.
 */
export const useRegistrosMarketing = (desde, hasta, moneda) => {
    const registros = useVerRegistros();
    const abrir = useCallback((fuente, metrica, titulo, segmento = undefined, nombreSegmento = '') => registros.abrir({
        titulo: `${titulo} · ${FUENTE[fuente]}${nombreSegmento ? ` · ${nombreSegmento}` : ''}`,
        subtitulo: `${desde} a ${hasta}`,
        contenido: <ContenidoRegistros fuente={fuente} metrica={metrica} desde={desde} hasta={hasta} moneda={moneda} segmento={segmento} />,
    }), [registros.abrir, desde, hasta, moneda]);
    return { abrir, panel: registros.panel };
};

export default useRegistrosMarketing;
