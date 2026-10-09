// Con qué rol simular a una persona que tiene varios: la misma pantalla de elección del login
// (Eleccion), encima de lo que se esté viendo. Sin esto, simular a alguien con varios roles entraba
// siempre con el principal, y no había forma de simular su rol de Hiring (o el que fuera).
//
// Si la persona ve finanzas, va también la tarjeta «Finances» (08/10/2026), como en el login: /finanzas
// es una vista aparte del dashboard comercial.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from 'lucide-react';
import Eleccion from '../../pages/auth/Eleccion';
import { ICONO_DE_ROL, ICONO_FINANZAS, RUTA_FINANZAS, rolDeFinanzas, rotuloDeRol, TITULO_FINANZAS } from '../../utils/cuentasVinculadas';

/** Los roles de una cuenta del listado de equipo (`roles`, con el principal primero). */
export const rolesDePersona = (u) => (u?.roles?.length ? u.roles : [u?.role]).filter(Boolean);

/** True si tiene más de un rol. */
export const tieneVariosRoles = (u) => rolesDePersona(u).length > 1;

/**
 * True si hay que preguntar con qué simularla: tiene varios roles, o uno solo pero ve finanzas (elige
 * entre la pantalla de su rol y Finances, como al entrar).
 */
export const hayQueElegir = (u) => tieneVariosRoles(u) || !!rolDeFinanzas(rolesDePersona(u), u?.can_view_finance);

/**
 * persona: { username, roles, role, can_view_finance }. onElegir(rol, destino): hace la simulación y va
 * a `destino`, o a la pantalla del rol si es null (puede ser async; si falla, que lance). onCancelar:
 * vuelve a lo que se estaba viendo. Mientras entra, las tarjetas quedan bloqueadas.
 *
 * Al final, si la persona ve finanzas, la tarjeta «Finances»: simula con el rol que las habilita y
 * abre /finanzas (ver `rolDeFinanzas`).
 */
export default function ElegirRolAlSimular({ persona, onElegir, onCancelar }) {
    const [eligiendo, setEligiendo] = useState(null);
    const [error, setError] = useState(null);
    const rolFinanzas = rolDeFinanzas(rolesDePersona(persona), persona.can_view_finance);

    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape' && !eligiendo) onCancelar(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [eligiendo, onCancelar]);

    const elegir = async (clave, rol, destino = null) => {
        setEligiendo(clave);
        setError(null);
        try {
            await onElegir(rol, destino);
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
                opciones={[
                    ...rolesDePersona(persona).map((rol) => ({
                        clave: rol, titulo: rotuloDeRol(rol), Icono: ICONO_DE_ROL[rol] || User,
                        onElegir: () => elegir(rol, rol),
                    })),
                    ...(rolFinanzas ? [{
                        clave: 'finanzas', titulo: TITULO_FINANZAS, Icono: ICONO_FINANZAS,
                        onElegir: () => elegir('finanzas', rolFinanzas, RUTA_FINANZAS),
                    }] : []),
                ]}
                pie={<button type="button" className="lg-link" onClick={onCancelar} disabled={!!eligiendo}>Cancelar</button>}
            />
        </div>,
        document.body,
    );
}
