// Datos de la sección Embudos (ADR-W204): la lista de embudos y la Guía de cada uno. La de Conversión es la
// misma que usa el chat (`useGuia`, compartida); la de los demás se pide aparte y vive en la sección.
import { useCallback, useEffect, useState } from 'react';
import { inboxApi } from '../api';
import { recordado, recordar } from '../recuerdo';
import { cargarGuia, fijarGuia, useGuia } from '../guia/useGuia';

export function useEmbudos() {
    const [datos, setDatos] = useState(() => recordado('embudos'));
    const [error, setError] = useState(false);
    const cargar = useCallback(() => inboxApi.embudos().then((d) => setDatos(recordar('embudos', d)), () => setError(true)), []);
    useEffect(() => { cargar(); }, [cargar]);
    return { datos, error, cargar };
}

/** [guía, fijar, recargar] del embudo. */
export function useGuiaDe(embudo) {
    const compartida = useGuia();
    const conversion = !embudo || embudo.conversion;
    const slug = embudo?.id;
    const [propia, setPropia] = useState(null);
    const recargar = useCallback(() => {
        if (conversion) return cargarGuia();
        return inboxApi.guia(slug).then(setPropia, () => setPropia({ error: true }));
    }, [conversion, slug]);
    useEffect(() => {
        if (conversion) return;
        setPropia(null);
        recargar();
    }, [conversion, recargar]);
    const fijar = useCallback((d) => (conversion ? fijarGuia(d) : setPropia(d)), [conversion]);
    return [conversion ? compartida : propia, fijar, recargar];
}

export const TRAMOS_EMBUDO = {
    auto: { nombre: 'Automática', color: 'var(--info)' },
    manual: { nombre: 'Manual', color: '#7D63E6' },
    agenda: { nombre: 'Agendamiento', color: 'var(--warning)' },
};
export const SALIDAS = [
    { id: 'nolead', nombre: 'No lead' },
    { id: 'inabrible', nombre: 'In-abrible' },
];
// Lo mismo que valida el servidor (`guia.py`): un automático sale antes de las 24 h.
export const HORAS_AUTO = 23.5;
export const nuevoId = () => Math.random().toString(36).slice(2, 8);
export const copia = (x) => JSON.parse(JSON.stringify(x));
