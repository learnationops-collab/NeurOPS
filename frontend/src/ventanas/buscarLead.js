// Abre «Buscar lead» (herramientas/BuscarLeadVentana.jsx) con una intención: sin intención abre la ficha;
// 'pago' la abre en Acciones (registrar un pago) y 'venta' en «Registrar una venta». Es lo que usan
// «Nuevo › Registrar un pago / Declarar una venta» y el atajo Ctrl+K.
import { useSyncExternalStore } from 'react';
import { abrirVentana } from './ventanasStore';

let intencion = null;
const oyentes = new Set();

export function abrirBuscarLead(nueva = null) {
    intencion = nueva;
    oyentes.forEach((fn) => fn());
    abrirVentana('buscar');
}

export const useIntencionDeBusqueda = () => useSyncExternalStore((fn) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
}, () => intencion);
