// Los datos del broadcast de un taller (ADR-W259, /api/whatsapp/talleres/<id>): el plan con su audiencia, sus
// pasos y el tope del día. Cada acción devuelve el plan entero, así la ventana siempre muestra lo guardado.
import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';

const REFRESCO = 15000;

export const mensajeDe = (e, fallback) => e?.response?.data?.message || fallback;

/** Cuántas variables ({{1}}, {{2}}…) tiene el texto de una plantilla. */
export const variablesDe = (texto = '') => Math.max(0, ...[...texto.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));

export const VARIABLES = [
    { value: 'nombre', label: 'Primer nombre' },
    { value: 'hora', label: 'Hora del taller' },
    { value: 'fecha', label: 'Día del taller' },
    { value: 'meet', label: 'Link de Meet' },
    { value: 'grupo', label: 'Link del grupo' },
    { value: 'fijo', label: 'Texto fijo…' },
];

export const A_QUIEN = [
    { value: 'todos', label: 'Todos' },
    { value: 'no_respondieron', label: 'No respondieron' },
    { value: 'tocaron', label: 'Tocaron…' },
    { value: 'etiqueta', label: 'Etiqueta…' },
];

export const pasoNuevo = () => ({
    id: null, nombre: '', modo: 'relativo', minutos: -120, dias: 0, hora: '10:00', plantilla: '', idioma: 'es',
    parametros: [], a_quien: 'todos', valor: '', excluir: [], estado: 'borrador', por_estado: {},
});

/** Cuándo sale, en palabras: «2 h antes», «el día anterior a las 10:00», «al programar». */
export function cuandoEnPalabras(p) {
    if (p.modo === 'ahora') return 'Al programar';
    if (p.modo === 'hora') {
        const d = Number(p.dias) || 0;
        const dia = d === 0 ? 'El día del taller' : d === -1 ? 'El día anterior' : d === 1 ? 'El día siguiente'
            : d < 0 ? `${-d} días antes` : `${d} días después`;
        return `${dia} · ${p.hora || '--:--'}`;
    }
    const m = Number(p.minutos) || 0;
    const abs = Math.abs(m);
    const cifra = abs % 1440 === 0 && abs ? `${abs / 1440} d` : abs % 60 === 0 && abs ? `${abs / 60} h` : `${abs} min`;
    return m === 0 ? 'Al empezar' : `${cifra} ${m < 0 ? 'antes' : 'después'}`;
}

const FORMATO = new Intl.DateTimeFormat('es', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const fechaCorta = (iso) => (iso ? FORMATO.format(new Date(iso)) : '');

export function useBroadcastTaller(tallerId) {
    const [plan, setPlan] = useState(null);
    const [error, setError] = useState(null);
    const ruta = `/whatsapp/talleres/${tallerId}`;

    const pedir = useCallback(() => api.get(ruta)
        .then((r) => { setPlan(r.data); setError(null); })
        .catch((e) => setError(mensajeDe(e, 'No se pudo cargar el broadcast del taller'))), [ruta]);

    useEffect(() => { setPlan(null); pedir(); }, [pedir]);

    // Mientras algo sale (pendientes) o está programado, se vuelve a pedir para ver el avance.
    const enCurso = (plan?.pasos || []).some((p) => p.estado === 'programado' || p.por_estado?.pendiente > 0);
    useEffect(() => {
        if (!enCurso) return undefined;
        const cada = setInterval(pedir, REFRESCO);
        return () => clearInterval(cada);
    }, [enCurso, pedir]);

    const con = (promesa) => promesa.then((r) => { setPlan(r.data); return r.data; });
    return {
        plan, error, recargar: pedir,
        guardar: (datos) => con(api.put(ruta, datos)),
        sumar: (datos) => con(api.post(`${ruta}/audiencia`, datos)),
        programar: () => con(api.post(`${ruta}/programar`)),
        pausar: () => con(api.post(`${ruta}/pausar`)),
        estandar: () => api.post(`${ruta}/estandar`).then((r) => r.data),
        numeros: (pasoId) => api.get(`${ruta}/pasos/${pasoId}`).then((r) => r.data.numeros),
    };
}
