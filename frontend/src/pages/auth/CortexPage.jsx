// /cortex: el área Cortex (10/10/2026), de todos los roles: lo que sabe el equipo en un solo lugar. Por
// ahora el Playbook (la formación interna, que abre su vista de siempre, PlaybookOverlay) y Learnito (el
// buscador con IA sobre el Playbook, próximamente). Antes los dos estaban en el menú de sesión.
// Es el área común a todos los roles: se entra desde el Portal y tiene su misma presentación.

import { useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import { roleLandingPath } from '../../utils/roleLanding';
import { abrirPortal } from '../../sesion/portalBus';
import Eleccion from './Eleccion';

export default function CortexPage() {
    const { user } = useAuth();
    const { openPlaybook, pendingCount } = usePlaybook();
    const navigate = useNavigate();
    const location = useLocation();
    // Sin historia en la app (un link directo), a la pantalla de su rol con el Portal abierto.
    const volver = () => {
        if (location.key !== 'default') { navigate(-1); return; }
        navigate(roleLandingPath(user?.role));
        abrirPortal();
    };

    return (
        <Eleccion
            nombre={user?.username}
            titulo="Cortex"
            pregunta="Lo que sabe el equipo, en un solo lugar."
            opciones={[
                {
                    clave: 'playbook', titulo: 'Playbook', sobre: 'Formación', Icono: GraduationCap, acento: '#6d8bff',
                    detalle: pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? 'video pendiente' : 'videos pendientes'}` : 'Roadmaps, módulos y lecciones',
                    onElegir: () => openPlaybook('pending'),
                },
                {
                    clave: 'learnito', titulo: 'Learnito', sobre: 'Buscador con IA', Icono: Sparkles, pronto: true,
                    detalle: 'Preguntale al Playbook',
                },
            ]}
            pie={<button type="button" className="lg-link" onClick={volver}>Volver</button>}
        />
    );
}
