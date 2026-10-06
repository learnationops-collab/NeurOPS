// Sección Funnels (id 'eventos'): los funnels con sus agendamientos, o el evento abierto (Configuración /
// Flujo). El closer ve sus eventos propios, como antes.

import { useEffect } from 'react';
import { buscar } from '../../core/datos';
import { useDatos, usePermisos, useUi } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import DetalleEvento from './DetalleEvento';
import ListaEventos from './ListaEventos';
import ListaFunnels from './ListaFunnels';

export default function Eventos() {
    const { d } = useDatos();
    const { ev } = useUi();
    const { modoCloser } = usePermisos();
    const e = ev && buscar(d, 'eventos', ev.id);
    // Si el evento abierto ya no existe (se borró o se deshizo su creación), vuelve a la lista.
    useEffect(() => { if (ev && !e) ui.set({ ev: null }); }, [ev, e]);
    if (ev && e) return <DetalleEvento key={e.id} e={e} ev={ev} />;
    return modoCloser ? <ListaEventos /> : <ListaFunnels />;
}
