// La conversación de Learnito vive acá, arriba de todas las pantallas: cerrar el modal o pasar de
// sección no la borra (recargar la página, sí). El modal se carga aparte la primera vez que se abre.
import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useState } from 'react';
import { useCopiloto } from '../pages/copiloto/useCopiloto';
import { registrarLearnito } from './learnito';

const LearnitoModal = lazy(() => import('../pages/copiloto/LearnitoModal'));
const Contexto = createContext(null);

export function LearnitoProvider({ children }) {
    const [abierto, setAbierto] = useState(false);
    const [borrador, setBorrador] = useState('');
    const conversacion = useCopiloto();

    useEffect(() => registrarLearnito(() => setAbierto(true)), []);

    const valor = useMemo(() => ({ ...conversacion, borrador, setBorrador }), [conversacion, borrador]);

    return (
        <Contexto.Provider value={valor}>
            {children}
            {abierto && (
                <Suspense fallback={null}>
                    <LearnitoModal onClose={() => setAbierto(false)} />
                </Suspense>
            )}
        </Contexto.Provider>
    );
}

export const useLearnito = () => useContext(Contexto);
