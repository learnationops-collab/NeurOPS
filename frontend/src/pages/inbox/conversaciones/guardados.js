// Los filtros guardados de este navegador (filtros.js) compartidos entre la cabecera, el panel del filtro y los
// chips de arriba de la lista: guardar en uno se ve en los otros sin recargar.
import { useEffect, useState } from 'react';
import { guardarPropios, propios } from './filtros';

const oyentes = new Set();
let actuales = null;

function leer() {
    if (actuales === null) actuales = propios();
    return actuales;
}

function escribir(lista) {
    actuales = lista;
    guardarPropios(lista);
    oyentes.forEach((o) => o(lista));
}

export function useGuardados() {
    const [lista, setLista] = useState(leer);
    useEffect(() => {
        oyentes.add(setLista);
        return () => oyentes.delete(setLista);
    }, []);
    return {
        lista,
        guardar: (label, filtro) => {
            const nuevo = { id: `f${Date.now()}`, label: label.slice(0, 40), filtro: { ...filtro } };
            escribir([...leer(), nuevo]);
            return nuevo;
        },
        borrar: (id) => escribir(leer().filter((g) => g.id !== id)),
    };
}
