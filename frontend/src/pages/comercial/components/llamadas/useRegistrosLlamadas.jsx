import { useCallback } from 'react';
import { useVerRegistros } from '../../../../components/standard';
import ContenidoRegistros from '../../../admin/marketing/anuncios/ContenidoRegistros';
import { getLlamadasRegistros } from '../../comercialApi';

/**
 * La lista detrás de cada cifra de «Destino de las agendas» y de «Por llamada» (ADR-W144).
 *
 * `abrir(que, titulo, { llamada, previo, subtitulo })` pide a `GET /comercial/llamadas/registros` las agendas que
 * suman esa cifra, con el mismo período y los mismos filtros del tablero (`filtros`), y las muestra en el marco
 * estándar (`useVerRegistros`). Cada fila abre la ficha del lead. `panel` va una vez en el JSX de quien lo usa.
 *
 * Sin `filtros` (un tablero que no los pasa), `abrir` es null y la cifra sigue yendo a Revisar.
 */
const useRegistrosLlamadas = (filtros) => {
    const { abrir: abrirMarco, panel } = useVerRegistros();
    const abrir = useCallback((que, titulo, { llamada = null, previo = false, subtitulo } = {}) => abrirMarco({
        titulo,
        subtitulo,
        contenido: <ContenidoRegistros fuente="comercial-llamadas" metrica="agendas"
            cargar={({ signal }) => getLlamadasRegistros(filtros, que, llamada, { signal }, { previo })} />,
    }), [abrirMarco, filtros]);
    return { abrir: filtros ? abrir : null, panel };
};

export default useRegistrosLlamadas;
