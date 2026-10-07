// Sección Eventos: la lista de eventos (agrupada por funnel, form o toda junta) o el evento abierto
// (Configuración / Flujo). El closer ve solo sus eventos propios.

import { useEffect } from 'react';
import { buscar } from '../../core/datos';
import { useDatos, useUi } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import DetalleEvento from './DetalleEvento';
import ListaEventos from './ListaEventos';

export default function Eventos() {
    const { d } = useDatos();
    const { ev } = useUi();
    const e = ev && buscar(d, 'eventos', ev.id);
    // Si el evento abierto ya no existe (se borró o se deshizo su creación), vuelve a la lista.
    useEffect(() => { if (ev && !e) ui.set({ ev: null }); }, [ev, e]);
    if (ev && e) return <DetalleEvento key={e.id} e={e} ev={ev} />;
    return <ListaEventos />;
}
