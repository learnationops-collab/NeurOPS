import { useCallback } from 'react';
import { useVerRegistros } from '../../../../components/standard';
import ContenidoRegistros from './ContenidoRegistros';

const FUENTE = { setting: 'Setting', workshop: 'Workshop', otras: 'Otras' };

/**
 * «Ver registros» de las cifras de Marketing: `abrir(fuente, metrica, titulo[, segmento, nombre, origen])` abre el panel
 * (lateral o central) con la lista de lo que suma esa cifra en el período, y `panel` va una vez en el JSX de la pantalla.
 * `origen`: solo las agendas de ese grupo de origen (Otras).
 */
export const useRegistrosMarketing = (desde, hasta, moneda, base) => {
    const registros = useVerRegistros();
    const abrir = useCallback((fuente, metrica, titulo, segmento = undefined, nombreSegmento = '', origen = undefined) => registros.abrir({
        titulo: `${titulo} · ${FUENTE[fuente]}${nombreSegmento ? ` · ${nombreSegmento}` : ''}${origen ? ` · ${origen}` : ''}`,
        subtitulo: `${desde} a ${hasta}`,
        contenido: <ContenidoRegistros fuente={fuente} metrica={metrica} desde={desde} hasta={hasta} moneda={moneda} base={base}
            segmento={segmento} origen={origen} />,
    }), [registros.abrir, desde, hasta, moneda, base]);
    return { abrir, panel: registros.panel };
};

export default useRegistrosMarketing;
