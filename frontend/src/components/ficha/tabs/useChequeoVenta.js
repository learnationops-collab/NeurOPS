import { useEffect, useState } from 'react';
import { chequearDatosVenta } from '../fichaApi';

const PASO = { email: 'venta_email', instagram: 'venta_instagram' };
const ROTULO = { email: 'El correo', instagram: 'El Instagram' };

/**
 * Los avisos de la revisión que salen del servidor: el correo o el Instagram de la venta ya son de
 * otra ficha con otro nombre. Si esa otra ficha los usó en una venta de los últimos 2 días, es casi
 * seguro el formulario anterior reusado: va como error. Si el pedido falla, no avisa nada.
 */
export function useChequeoVenta(activo, { clientId, nombre, email, instagram }) {
    const [avisos, setAvisos] = useState([]);
    useEffect(() => {
        if (!activo || !(email || instagram)) { setAvisos([]); return undefined; }
        const control = new AbortController();
        chequearDatosVenta({ clientId, nombre, email, instagram, signal: control.signal })
            .then(({ conflictos = [] }) => setAvisos(conflictos.map((c) => ({
                id: `otra-ficha-${c.campo}`,
                nivel: c.reciente ? 'error' : 'aviso',
                frena: c.reciente,
                paso: PASO[c.campo],
                texto: c.reciente
                    ? `${ROTULO[c.campo]} es de ${c.nombre || 'otra ficha'}, que tuvo una venta estos días: ¿quedó del formulario anterior?`
                    : `${ROTULO[c.campo]} ya está en la ficha de ${c.nombre || 'otra persona'}. Revisá que sea de este cliente.`,
            }))))
            .catch(() => {});
        return () => control.abort();
    }, [activo, clientId, nombre, email, instagram]);
    return avisos;
}
