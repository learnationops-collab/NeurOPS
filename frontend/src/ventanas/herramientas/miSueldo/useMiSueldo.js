// Los datos de «Mi sueldo» (GET /mi-sueldo): un pedido por mes y persona. Solo vale la respuesta del
// último pedido, y al cambiar de mes se deja lo anterior a la vista hasta que llegue lo nuevo.
import { useEffect, useRef, useState } from 'react';
import api from '../../../services/api';

export const COLORES = {
    base: 'var(--ln-info, #5aa9ff)', primer: 'var(--ln-brand, #ff3fa4)', cuotas: 'var(--ln-brand-2, #b48cff)',
    renovaciones: '#ff9ecf', upsells: '#2dd4bf', otros: 'var(--ln-text-faint, #999)',
    propia: 'var(--ln-brand, #ff3fa4)', director: 'var(--ln-warning, #f5b84a)',
    ajuste: 'var(--ln-idle, #94a3b8)', bonos: 'var(--ln-success, #3ecf8e)',
};

const dinero0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export const dinero = (n) => `${n < -0.004 ? '−' : ''}US$ ${dinero0.format(Math.abs(Math.round(n || 0)))}`;

/** Las filas de la columna izquierda de un mes: base, conceptos de la comisión, ajuste manual y bonos. */
export function filasDelMes(mes) {
    const filas = [{ k: 'base', titulo: 'Sueldo base', detalle: 'El fijo del mes, de la Nómina de Finanzas', monto: mes.base }];
    filas.push(...mes.conceptos.map(c => ({ ...c, conPagos: true })));
    if (mes.comision_manual != null) {
        filas.push({ k: 'ajuste', titulo: 'Ajuste manual', monto: mes.comision_manual - mes.comision_calculada,
            detalle: `La comisión se escribió a mano en Finanzas: ${dinero(mes.comision_manual)} (el cálculo da ${dinero(mes.comision_calculada)})` });
    }
    if (mes.bonos > 0.004) filas.push({ k: 'bonos', titulo: 'Bonos', detalle: 'Cargados a mano en la Nómina de Finanzas', monto: mes.bonos });
    return filas;
}

export function useMiSueldo() {
    const [pedido, setPedido] = useState({ mes: null, clave: null });
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(true);
    const ultimo = useRef(0);

    useEffect(() => {
        const n = ++ultimo.current;
        const params = {};
        if (pedido.mes) params.mes = pedido.mes;
        if (pedido.clave) params.clave = pedido.clave;
        api.get('/mi-sueldo', { params, skipBugReport: true })
            .then(({ data }) => { if (n === ultimo.current) { setDatos(data); setError(null); } })
            .catch((e) => { if (n === ultimo.current) setError(e?.response?.data?.message || 'No se pudo cargar el sueldo'); })
            .finally(() => { if (n === ultimo.current) setCargando(false); });
    }, [pedido.mes, pedido.clave]);

    return {
        datos, error, cargando,
        irAMes: (mes) => { setCargando(true); setPedido(p => ({ ...p, mes })); },
        elegirPersona: (clave) => { setCargando(true); setPedido({ mes: datos?.mes || null, clave }); },
    };
}
