import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * Los pedidos del tablero comercial, por clave ('contexto', 'resumen', 'tabla'…).
 *
 * Solo la respuesta del ÚLTIMO pedido de cada clave llega a la pantalla: cambiar de filtro dispara
 * uno nuevo sin cancelar el anterior, y no vuelven en orden (90 días tarda más que un día). Si la
 * vieja llegaba después, pisaba los números con los de un período que ya no estaba elegido.
 *
 * `fallas[clave]` queda en true si el último pedido de esa clave falló, para que su bloque ofrezca
 * reintentar en vez de quedarse en el esqueleto para siempre. Se apaga al volver a pedir.
 */
export default function usePedidos() {
    const pedidos = useRef({});
    const [fallas, setFallas] = useState({});

    const pedir = useCallback((clave, promesa, poner, mensaje) => {
        const n = (pedidos.current[clave] || 0) + 1;
        pedidos.current[clave] = n;
        const vigente = () => pedidos.current[clave] === n;
        // Reintentar vuelve al esqueleto mientras espera: el aviso de la falla ya no es la verdad.
        setFallas(f => (f[clave] ? { ...f, [clave]: false } : f));
        return promesa
            .then((datos) => { if (vigente()) poner(datos); })
            .catch(() => {
                if (!vigente()) return;
                setFallas(f => ({ ...f, [clave]: true }));
                if (mensaje) toast.error(mensaje);
            });
    }, []);

    return { pedir, fallas };
}
