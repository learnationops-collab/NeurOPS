// La elección de rol de la entrada: una tarjeta por rol de la cuenta, una por cuenta vinculada y, si la
// persona ve finanzas, «Finances» (08/10/2026). La usan el login, después de la clave, y el hub de
// vistas (/vistas, ElegirVistaPage), así que elegir funciona igual en los dos: el rol con el que está
// sigue con `onElegido`; otro rol se activa en la cuenta y entra a su pantalla; Finances va a /finanzas.

import { useState } from 'react';
import { User } from 'lucide-react';
import {
    cambiarDeRol, cambiarDeRolEnLaCuenta, ICONO_DE_ROL, ICONO_FINANZAS, otrasCuentas, RUTA_FINANZAS, rolDeFinanzas,
    rolesDeLaCuenta, rotuloDeRol, TITULO_FINANZAS,
} from '../../utils/cuentasVinculadas';
import Eleccion from './Eleccion';

/**
 * user: el de la sesión. onElegido(user, destino): sigue con el rol con el que está; `destino` solo lo
 * pasa «Finances». pregunta y pie: los de Eleccion.
 */
export default function ElegirRol({ user, onElegido, pregunta = 'Seleccioná tu rol. Después podés cambiarlo desde tu menú.', pie = null }) {
    const [eligiendo, setEligiendo] = useState(null);
    const [error, setError] = useState(null);
    const roles = rolesDeLaCuenta(user);
    // «Finances» no es un rol: entra con el que la habilita (ver `rolDeFinanzas`) y va a /finanzas.
    const rolFinanzas = rolDeFinanzas(roles, user.can_view_finance);
    const opciones = [
        ...roles.map((rol) => ({ clave: `rol-${rol}`, titulo: rotuloDeRol(rol), Icono: ICONO_DE_ROL[rol], entrar: () => (rol === user.role ? onElegido(user) : cambiarDeRolEnLaCuenta(rol)) })),
        ...otrasCuentas(user).map((c) => ({ clave: `cuenta-${c.id}`, titulo: rotuloDeRol(c.role), Icono: ICONO_DE_ROL[c.role], detalle: c.username, entrar: () => cambiarDeRol(c.id) })),
        ...(rolFinanzas ? [{
            clave: 'finanzas', titulo: TITULO_FINANZAS, Icono: ICONO_FINANZAS,
            entrar: () => (rolFinanzas === user.role ? onElegido(user, RUTA_FINANZAS) : cambiarDeRolEnLaCuenta(rolFinanzas, RUTA_FINANZAS)),
        }] : []),
    ];

    const elegir = async (o) => {
        setEligiendo(o.clave);
        setError(null);
        try {
            await o.entrar();
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo entrar con ese rol');
            setEligiendo(null);
        }
    };

    return (
        <Eleccion
            nombre={user.username}
            pregunta={pregunta}
            eligiendo={eligiendo}
            error={error}
            opciones={opciones.map((o) => ({
                clave: o.clave, titulo: o.titulo, detalle: o.detalle, Icono: o.Icono || User,
                onElegir: () => elegir(o),
            }))}
            pie={pie}
        />
    );
}
