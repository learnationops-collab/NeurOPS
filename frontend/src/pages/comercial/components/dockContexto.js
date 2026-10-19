import { createContext } from 'react';

// Lo que el menú de sesión le pasa al dock que lo contiene: sus opciones fijables, para que la sección
// de la izquierda (DockFijadas) dibuje las fijadas con la acción de esa pantalla. Fuera de un dock es null.
export const DockContexto = createContext(null);
