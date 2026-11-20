import api from '../../services/api';

/**
 * Programas y segmentos (ADR-W177). `periodo`: `{ desde, hasta }` (Marketing) o los parámetros del header de
 * Dirección comercial (`period`, `start_date`, `end_date`); el backend acepta los dos.
 */
export const pedirProgramasSegmentos = (periodo, config = {}) =>
    api.get('/programas-segmentos', { params: periodo, ...config }).then((r) => r.data);

/** La lista de una cifra: `{ metrica, programa }` o `{ metrica, segmento }` (vacío = todo Setting). */
export const pedirRegistrosProgramas = (periodo, cual, config = {}) =>
    api.get('/programas-segmentos/registros', { params: { ...periodo, ...cual }, ...config }).then((r) => r.data);
