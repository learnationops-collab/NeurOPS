// Las herramientas del rol como opciones del menú de sesión (MenuSesion las suma solas a todos los docks):
// así se abren desde ahí y se fijan en el dock con el mismo 📌 que el resto (sesion/fijadas.js), como los
// pins de la Academia y las islas de Leadership.
import { useAuth } from '../contexts/AuthContext';
import { herramientasDe, idDeHerramienta } from './herramientas';
import { abrirVentana } from './ventanasStore';

export default function useOpcionesDeHerramientas() {
    const { user } = useAuth();
    return herramientasDe(user).map(h => ({
        id: idDeHerramienta(h.key),
        label: h.label,
        titulo: h.hint,
        Icono: h.Icono,
        onClick: () => abrirVentana(h.key),
    }));
}
