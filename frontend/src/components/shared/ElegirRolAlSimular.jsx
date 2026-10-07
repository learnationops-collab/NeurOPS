// Con qué rol simular a una persona que tiene varios: la misma pantalla de elección del login
// (Eleccion), encima de lo que se esté viendo. Sin esto, simular a alguien con varios roles entraba
// siempre con el principal, y no había forma de simular su rol de Hiring (o el que fuera).

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from 'lucide-react';
import Eleccion from '../../pages/auth/Eleccion';
import { ICONO_DE_ROL, rotuloDeRol } from '../../utils/cuentasVinculadas';

/** Los roles de una cuenta del listado de equipo (`roles`, con el principal primero). */
export const rolesDePersona = (u) => (u?.roles?.length ? u.roles : [u?.role]).filter(Boolean);

/** True si hay que preguntar con qué rol simularla. */
export const tieneVariosRoles = (u) => rolesDePersona(u).length > 1;

/**
 * persona: { username, roles, role }. onElegir(rol): hace la simulación (puede ser async; si falla, que
 * lance). onCancelar: vuelve a lo que se estaba viendo. Mientras entra, las tarjetas quedan bloqueadas.
 */
export default function ElegirRolAlSimular({ persona, onElegir, onCancelar }) {
    const [eligiendo, setEligiendo] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape' && !eligiendo) onCancelar(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [eligiendo, onCancelar]);

    const elegir = async (rol) => {
        setEligiendo(rol);
        setError(null);
        try {
            await onElegir(rol);
        } catch (err) {
            setError(err?.response?.data?.message || 'No se pudo iniciar la simulación');
            setEligiendo(null);
        }
    };

    return createPortal(
        <div className="elegir-rol-simular" role="dialog" aria-modal="true" aria-label={`Simular a ${persona.username}`}
            style={{ position: 'fixed', inset: 0, zIndex: 160, overflowY: 'auto' }}>
            <Eleccion
                nombre={persona.username}
                pregunta={`Vas a simular a ${persona.username}. Elegí con qué rol.`}
                eligiendo={eligiendo}
                error={error}
                opciones={rolesDePersona(persona).map((rol) => ({
                    clave: rol, titulo: rotuloDeRol(rol), Icono: ICONO_DE_ROL[rol] || User,
                    onElegir: () => elegir(rol),
                }))}
                pie={<button type="button" className="lg-link" onClick={onCancelar} disabled={!!eligiendo}>Cancelar</button>}
            />
        </div>,
        document.body,
    );
}
