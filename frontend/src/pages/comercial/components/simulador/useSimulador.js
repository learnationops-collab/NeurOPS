import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSimuladorBase } from '../../comercialApi';
import { crudosDe, mesesDelHorizonte, perfilDe, proyectar, ventanaDeBase } from './modelo';
import { cuantasTocadas } from './palancas';

export const HORIZONTES = [1, 2, 3];
export const DIAS = ['14', '30', '60'];
// Capacidad libre del equipo hoy, de arranque: ver `modelo.js`. Se puede cambiar en pantalla.
export const HOLGURA_INICIAL = 20;

/**
 * Estado y cuentas del Simulador. Los escenarios viven SOLO acá, en memoria: no se guardan ni viajan
 * al servidor (pedido de Kerwin, 24/10/2026), así que recargar la página los deshace.
 */
export default function useSimulador(permitido) {
    const [base, setBase] = useState(null);
    const [falla, setFalla] = useState(false);
    const [linea, setLinea] = useState('mes');
    const [dias, setDias] = useState('30');
    const [horizonte, setHorizonte] = useState(1);
    const [holgura, setHolgura] = useState(HOLGURA_INICIAL);
    const [palancas, setPalancas] = useState({});

    const pedir = useCallback(() => getSimuladorBase().then(setBase).catch(() => setFalla(true)), []);
    useEffect(() => { if (permitido) pedir(); }, [permitido, pedir]);
    const cargar = useCallback(() => { setFalla(false); pedir(); }, [pedir]);

    const poner = useCallback((clave, estado) => setPalancas(p => {
        const siguiente = { ...p };
        if (estado) siguiente[clave] = estado;
        else delete siguiente[clave];
        return siguiente;
    }), []);
    const restablecer = useCallback(() => setPalancas({}), []);

    const meses = useMemo(() => (base ? mesesDelHorizonte(base.hoy, horizonte) : []), [base, horizonte]);
    const ya = useMemo(() => (base?.ventanas.mes ? crudosDe(base.ventanas.mes) : null), [base]);

    /** El perfil y la proyección de una línea base (`mes`, `14`, `30` o `60`), con las palancas puestas. */
    const calcular = useCallback((clave, conPalancas) => {
        const { ventana, respaldo, clave: usada } = ventanaDeBase(clave, base);
        const perfil = perfilDe(ventana, base);
        if (!perfil) return null;
        return { perfil, respaldo, usada, proy: proyectar(perfil, meses, ya, conPalancas, holgura / 100) };
    }, [base, meses, ya, holgura]);

    const lineaClave = linea === 'mes' ? 'mes' : dias;
    const actual = useMemo(
        () => (base ? calcular(lineaClave, palancas) : null), [base, calcular, lineaClave, palancas]);
    // Las dos líneas base lado a lado, sin palancas: la proyección «si todo se mantiene».
    const comparadas = useMemo(() => (base ? {
        mes: calcular('mes', {}),
        dias: calcular(dias, {}),
    } : null), [base, calcular, dias]);

    return {
        base, falla, cargar, linea, setLinea, dias, setDias, horizonte, setHorizonte, holgura, setHolgura,
        palancas, poner, restablecer, tocadas: cuantasTocadas(palancas), meses, actual, comparadas,
    };
}
