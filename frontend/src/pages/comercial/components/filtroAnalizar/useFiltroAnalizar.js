import { useEffect, useMemo, useState } from 'react';
import { getTabla } from '../../comercialApi';
import { TABLAS } from '../tablasDef';
import { aplicarFiltros, hayCondiciones, modoCumple } from '../filtroFacetas';

/** La tabla Agendas de Revisar: sus facetas son las del Filtro completo de Analizar (ADR-W190). */
export const DEF_AGENDAS = TABLAS.agendas;

/**
 * El Filtro completo de Analizar: las agendas del período (y del comparado) filtradas con la MISMA regla que
 * Revisar (`aplicarFiltros`), y sus ids para pedir el resumen sobre ellas.
 *
 * Las filas se piden sin segmento ni país (`segmento: null, pais: null`): esas dos son facetas más del panel, y
 * así cada opción muestra cuántas agendas tiene. Las de triage (`de_triage`, la marca del backend con la regla de
 * `_sin_triage`) se sacan salvo que se mire a una persona: Analizar es de closing.
 *
 * `ids` es null sin condiciones: el resumen se pide como siempre.
 */
const useFiltroAnalizar = ({ activo, filtros, filtro, conPersona }) => {
    const base = useMemo(() => ({ ...filtros, segmento: null, pais: null }), [filtros]);
    const clave = JSON.stringify(base);
    const [datos, setDatos] = useState(null);
    const [fallo, setFallo] = useState(false);

    useEffect(() => {
        if (!activo) return undefined;
        let vivo = true;
        setFallo(false);
        getTabla(base, 'agendas', 'meet', { previo: true })
            .then((d) => { if (vivo) setDatos({ ...d, clave }); })
            .catch((e) => {
                console.error(`Filtro de Analizar: ${e}`);
                if (vivo) setFallo(true);
            });
        return () => { vivo = false; };
        // `base` cambia con `clave`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activo, clave]);

    const vigentes = datos?.clave === clave ? datos : null;
    const facetas = useMemo(() => filtro?.facetas || {}, [filtro?.facetas]);
    const modo = modoCumple(filtro?.modo);

    const filas = useMemo(() => {
        const todas = vigentes?.filas || [];
        return conPersona ? todas : todas.filter(f => !f.de_triage);
    }, [vigentes, conPersona]);
    const filasPrevio = useMemo(() => {
        const todas = vigentes?.filas_previo || [];
        return conPersona ? todas : todas.filter(f => !f.de_triage);
    }, [vigentes, conPersona]);

    const conCondiciones = hayCondiciones(DEF_AGENDAS, facetas);
    const filtradas = useMemo(() => aplicarFiltros(filas, DEF_AGENDAS, '', facetas, modo),
        [filas, facetas, modo]);
    const ids = useMemo(() => {
        if (!conCondiciones || !vigentes) return null;
        return {
            agendas: filtradas.map(f => f.id),
            agendas_previo: aplicarFiltros(filasPrevio, DEF_AGENDAS, '', facetas, modo).map(f => f.id),
        };
    }, [conCondiciones, vigentes, filtradas, filasPrevio, facetas, modo]);

    // Las de triage que el filtro deja pasar: Revisar las lista y Analizar no, así se dice la diferencia.
    const deTriage = useMemo(() => (conPersona || !vigentes ? 0
        : aplicarFiltros(vigentes.filas.filter(f => f.de_triage), DEF_AGENDAS, '', facetas, modo).length),
    [conPersona, vigentes, facetas, modo]);

    return { filas, filtradas, ids, conCondiciones, deTriage, listo: !!vigentes, fallo };
};

export default useFiltroAnalizar;
