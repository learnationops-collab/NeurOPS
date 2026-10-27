// Los setters activos ({id, nombre}), pedidos una sola vez por sesión de la pantalla: para reasignar una
// conversación o asignar una tarea.
import { useEffect, useState } from 'react';
import { inboxApi } from '../api';

let cache = null;

export default function useEquipo() {
    const [equipo, setEquipo] = useState(cache);
    useEffect(() => {
        if (cache) return;
        inboxApi.setters().then((s) => { cache = s; setEquipo(s); }).catch(() => setEquipo([]));
    }, []);
    return equipo || [];
}
