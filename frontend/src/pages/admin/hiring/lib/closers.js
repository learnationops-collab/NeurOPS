import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../../services/api';

// El Inbox de Talent mira una búsqueda a la vez (ADR-W192): Asistentes (sus formularios de
// Talent) o Closers (el formulario de institute.thelearnation.com/formulario, tabla
// `job_applications`). Acá vive lo de Closers: el pedido, la búsqueda y la ficha armada con
// las mismas piezas que la de Asistente.

export const PUESTOS = [
    { id: 'asistente', n: 1, label: 'Asistentes', c: 'var(--brand-secondary)' },
    { id: 'closer', n: 2, label: 'Closers', c: 'var(--info)' },
];

// Con Closers elegido, Analyze y Winners muestran closers por veredicto (votos de los revisores y
// resolución manual, ver JobApplication.veredicto): las mismas pestañas que Asistentes, más «A decidir»
// cuando los revisores votaron distinto.
export const PESTANAS_CLOSER_SECCION = {
    anal: [
        { id: 'preseleccionada', label: 'Seleccionadas', c: 'var(--success)' },
        { id: 'en_reserva', label: 'Reserva', c: 'var(--info)' },
        { id: 'decidir', label: 'A decidir', c: 'var(--warning)' },
        { id: 'descartado', label: 'Descartadas', c: 'var(--idle)' },
    ],
    fin: [
        { id: 'testeo', label: 'En prueba', c: 'var(--warning)' },
        { id: 'baja', label: 'Baja', c: 'var(--error)' },
    ],
};

const CLAVE_PUESTO = 'talent_inbox_puesto';

export const leerPuesto = () => {
    try {
        return localStorage.getItem(CLAVE_PUESTO) === 'closer' ? 'closer' : 'asistente';
    } catch {
        return 'asistente'; // sin localStorage (modo privado): se entra a Asistentes
    }
};

export const guardarPuesto = (puesto) => {
    try {
        localStorage.setItem(CLAVE_PUESTO, puesto);
    } catch (err) {
        console.error('No se pudo recordar el puesto del Inbox:', err);
    }
};

/** Todas las postulaciones de Closer: las completas (con score) y las que quedaron a medias. */
export function useClosers() {
    const [filas, setFilas] = useState([]);
    const [incompletas, setIncompletas] = useState([]);
    // «Antiguos» (ADR-W193): las archivadas se piden recién cuando se abren; la cuenta viene con el resto.
    const [archivadas, setArchivadas] = useState(null);
    const [cuentaArchivadas, setCuentaArchivadas] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const cargar = useCallback(async ({ silencioso = false } = {}) => {
        if (!silencioso) setCargando(true);
        try {
            const [completas, aMedias] = await Promise.all([
                api.get('/job-applications?filtro=todas'),
                api.get('/job-applications?filtro=incompletas'),
            ]);
            setFilas(completas.data.postulaciones || []);
            setIncompletas(aMedias.data.postulaciones || []);
            setCuentaArchivadas(completas.data.conteos?.archivadas || 0);
            setError('');
        } catch (err) {
            console.error('Error al cargar postulaciones de Closer:', err);
            setError('No se pudieron cargar las postulaciones de Closer.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const cargarArchivadas = useCallback(async () => {
        try {
            const res = await api.get('/job-applications?filtro=archivadas');
            setArchivadas(res.data.postulaciones || []);
        } catch (err) {
            console.error('Error al cargar las postulaciones de Closer archivadas:', err);
            setArchivadas([]);
            setError('No se pudieron cargar las postulaciones anteriores.');
        }
    }, []);

    const porRevisar = useMemo(() => filas.filter((p) => p.veredicto === 'sin_calificar'), [filas]);
    return {
        filas, incompletas, porRevisar, archivadas, cuentaArchivadas, cargando, error, cargar, cargarArchivadas,
    };
}

const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const coincideCloser = (p, q) => {
    const b = plano(q);
    return [p.nombre, p.pais, p.email, p.whatsapp].some((v) => plano(v).includes(b));
};

/** «25 a 29 años» → «25 a 29»: el panel de la ficha ya le suma «años». */
export const edadCorta = (edad) => (edad ? String(edad).replace(/\s*años?\s*$/i, '') : null);

export const NIVEL_INGLES = { Fluido: 3, Intermedio: 2, 'Básico': 1, Nada: 0 };

/** El cierre llega como texto: «nada» o el número 0-100. */
export const cierreNum = (c) => {
    const n = Number(c);
    return c == null || c === '' || c === 'nada' || Number.isNaN(n) ? null : n;
};

export const CONOCIMIENTO_CORTO = {
    'Tengo formación + experiencia': 'Formación + experiencia',
    'Tengo experiencia': 'Experiencia',
    'Tengo formación': 'Formación',
};

// --- Ficha: las respuestas del closer con la forma que dibuja la ficha de Asistente ---

const lista = (v) => (Array.isArray(v) ? (v.length ? v.join(' | ') : null) : (v || null));
const pregunta = (id, t, valor, tipo = 'texto', extra = {}) => ({
    id, t, tipo, valor: valor === '' || valor == null ? null : valor, ...extra,
});

export const seccionesCloser = (d) => {
    const cierre = cierreNum(d.cierre);
    const experiencia = [
        pregunta('conocimiento', 'Conocimiento como closer', d.conocimiento),
        cierre == null
            ? pregunta('cierre', 'Cierre sobre llamada tomada', d.cierre === 'nada' ? 'No lo mide' : null)
            : pregunta('cierre', 'Cierre sobre llamada tomada', cierre, 'numero', { unidad: '%' }),
        pregunta('ingles', 'Inglés', d.ingles),
        pregunta('reporte', 'Reportar sus números a diario', d.reporte),
        pregunta('dedicacion', 'A qué se dedica hoy', d.dedicacion, 'parrafo'),
    ];
    if (lista(d.herramientas)) experiencia.push(pregunta('herramientas', 'Herramientas', lista(d.herramientas), 'check'));
    return [
        {
            titulo: 'Cualitativo',
            preguntas: [
                pregunta('formacion', 'Formación como closer', d.formacion, 'parrafo'),
                pregunta('habilidades', 'Experiencia en venta', d.habilidades, 'parrafo'),
                pregunta('obstaculo', 'Si el cierre baja, qué hace', d.obstaculo, 'parrafo'),
                pregunta('objetivos', 'Objetivos a largo plazo', d.objetivos, 'parrafo'),
                pregunta('porque_mejor_opcion', 'Por qué es la mejor opción', d.porque_mejor_opcion, 'parrafo'),
            ],
        },
        { titulo: 'Experiencia', preguntas: experiencia },
        {
            titulo: 'Motivación',
            preguntas: [
                pregunta('aportes', 'Qué más aporta al equipo', lista(d.aportes), Array.isArray(d.aportes) ? 'check' : 'parrafo'),
                pregunta('porque', 'Por qué Learnation', lista(d.porque), Array.isArray(d.porque) ? 'check' : 'parrafo'),
            ],
        },
        {
            titulo: 'Archivos',
            preguntas: [
                pregunta('video', 'Video de presentación', d.video, 'link'),
                pregunta('llamada', 'Mejor llamada o roleplay', d.llamada, 'link'),
            ],
        },
    ];
};

// Cada criterio de Clarity con la pregunta que lo alimenta y su nombre corto en el desglose.
const CRITERIO = {
    formacion: ['formacion', 'Formación'],
    experiencia: ['conocimiento', 'Experiencia'],
    cierre: ['cierre', 'Cierre'],
    video: ['video', 'Video y llamada'],
    obstaculo: ['obstaculo', 'Obstáculo'],
    ingles: ['ingles', 'Inglés'],
    herramientas: ['herramientas', 'Herramientas'],
    objetivos: ['objetivos', 'Objetivos'],
};

/** `criterios` del detalle → `puntaje` de la ficha: un renglón por criterio con peso. */
export const puntajeCloser = (criterios = []) => criterios
    .filter((c) => c.peso > 0 && CRITERIO[c.criterion])
    .map((c) => ({
        id: CRITERIO[c.criterion][0],
        bloque: CRITERIO[c.criterion][1],
        puntos: c.valor * c.peso,
        maximo: c.peso,
        peso: c.peso,
    }));

/** Las tres decisiones de siempre (son votos: tocar el mismo otra vez lo deshace) y «Pasar a prueba». */
export const accionesCloser = (veredicto) => {
    const votos = ['pre', 'res', 'des'];
    return ['preseleccionada', 'testeo'].includes(veredicto) ? [...votos.slice(0, 1), 'testeo', ...votos.slice(1)] : votos;
};
