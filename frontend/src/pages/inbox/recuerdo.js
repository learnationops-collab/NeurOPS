// Lo último que se vio de cada lista del Inbox (cacheDeVistas, en memoria): al volver a una sección o
// abrir de nuevo un chat se ve al instante, sin «Cargando…», y la pantalla lo vuelve a pedir siempre
// por detrás. Son listas que cambian solas, por eso no se usa la vigencia de 5 minutos.
import { guardarCache, leerCache } from '../../services/cacheDeVistas';

export const recordado = (clave, vacio = null) => leerCache(`inbox:${clave}`)?.datos ?? vacio;
export const recordar = (clave, datos) => { guardarCache(`inbox:${clave}`, datos); return datos; };
