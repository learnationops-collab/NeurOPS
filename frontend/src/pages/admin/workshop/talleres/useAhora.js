import { useEffect, useState } from 'react';

/** La hora de ahora, refrescada cada `cadaMs` (para las cuentas regresivas de la grabación). */
const useAhora = (cadaMs = 1000, activo = true) => {
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => {
        if (!activo) return undefined;
        const t = setInterval(() => setAhora(Date.now()), cadaMs);
        return () => clearInterval(t);
    }, [cadaMs, activo]);
    return ahora;
};

export default useAhora;
