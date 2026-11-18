// Configuración dentro de su ventana flotante (ventanas/herramientas.js, ADR-W169): se minimiza al dock, se
// maximiza y se arrastra como las demás. `item.tab` es la sección con la que se abrió.
import { useAuth } from '../contexts/AuthContext';
import Configuracion from './Configuracion';

export default function ConfiguracionVentana({ item }) {
    const { user } = useAuth();
    if (!user) return null;
    return <Configuracion key={item?.tab || '-'} user={user} tabInicial={item?.tab || null} />;
}
