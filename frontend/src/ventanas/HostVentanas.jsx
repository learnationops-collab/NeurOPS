// Dibuja las ventanas abiertas, encima de cualquier pantalla. Va una sola vez en App.jsx (dentro de
// SoloInterno): así flota también sobre el espacio del setter y el mazo del closer, que no usan MainLayout,
// y no se cierra al navegar. Una minimizada sigue montada (no pierde lo que tenía), solo no se ve.

import { Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { herramienta } from './herramientas';
import Ventana from './Ventana';
import { useVentanas } from './ventanasStore';
import './ventanas.css';

export default function HostVentanas() {
    const { user } = useAuth();
    const items = useVentanas();
    if (!user) return null;
    return items.map(item => {
        const h = herramienta(item.key);
        if (!h || !h.roles.includes(user.role)) return null;
        return (
            <Ventana key={item.key} item={item} h={h}>
                <Suspense fallback={<p className="vt-cargando">Cargando…</p>}>
                    <h.Componente />
                </Suspense>
            </Ventana>
        );
    });
}
