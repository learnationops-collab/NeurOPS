import { useCallback, useState } from 'react';

/**
 * Qué grupos de una `ListaAgrupable` abrió o cerró el usuario a mano: clave del grupo → abierto.
 *
 * Lo que no está en el mapa toma el valor por defecto, que decide `ListaAgrupable` (cerrado, salvo
 * el grupo único). Es un hook aparte porque la memoria tiene que vivir en el componente que NO se
 * desmonta mientras se usa la lista, y ése no siempre es la lista. En Revisar la lista se desmonta
 * cada vez que se recarga (el esqueleto la reemplaza), cuando un filtro la deja vacía y al alternar
 * lista/tarjetas; con el mapa adentro de la lista, el grupo que el closer estaba revisando se
 * cerraba después de cada cosa que registraba en la ficha. Revisar llama a este hook y le pasa el
 * mapa a la lista; una lista que nadie controla llama al suyo propio.
 *
 * `clave` es lo que, al cambiar, vuelve todo a cerrado: la dimensión de la agrupación (las claves de
 * "por closer" no significan nada en "por fuente"), y en Revisar también la tabla. El reinicio es
 * durante el render —el patrón de React para "recalcular estado cuando cambia una entrada"— y no en
 * un efecto, que habría dibujado un cuadro con los grupos abiertos de la dimensión anterior. Tiene
 * que ser un string y no la dimensión: una dimensión armada en línea cambia de identidad en cada
 * render y el reinicio no convergería.
 */

export const useGruposElegidos = (clave) => {
    const [deClave, setDeClave] = useState(clave);
    const [elegidos, setElegidos] = useState(() => new Map());
    if (deClave !== clave) {
        setDeClave(clave);
        setElegidos(new Map());
    }

    /** Anota que el grupo `claveGrupo` quedó `abierto` (true) o cerrado (false). */
    const elegir = useCallback((claveGrupo, abierto) => setElegidos(previos => {
        const siguiente = new Map(previos);
        siguiente.set(claveGrupo, abierto);
        return siguiente;
    }), []);

    return [elegidos, elegir];
};

export default useGruposElegidos;
