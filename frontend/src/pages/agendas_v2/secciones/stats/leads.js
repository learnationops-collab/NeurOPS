// Los leads que miden Stats y el mapa de calor del flujo. Con la API son los reales
// (GET /agendas-v2/estadisticas, últimos 180 días): los que agendaron y los que dejaron sus datos y se
// cayeron antes. En modo local (tests, VITE_AGENDAS_LOCAL) son los de ejemplo (datosEjemplo.js).
// Cada lead: {t, ev, llego, desc, agenda, score, closer, setter, origen, grupo, hora, dow}.
// `llego`: 0 entró, 1 dejó el contacto, 2..n+1 respondió cada pregunta, n+2 llegó al calendario, n+3 agendó.

import { useEffect, useMemo, useState } from 'react';
import api from '../../../../services/api';
import { MODO_LOCAL } from '../../data/modo';
import { useDatos } from '../../data/hooks';
import { buscar, nombreOrigen } from '../../core/datos';
import { slugify } from '../../core/util';
import { datosEjemplo } from './datosEjemplo';

const DIA = 86400000;
// Lo traído se reusa un rato (cambiar de sección no vuelve a pedir); una agenda nueva lo renueva.
const VIGENCIA = 60000;

let cache = null; // {t, clave, crudos}
let enCurso = null;

function traer(clave) {
    if (cache && cache.clave === clave && Date.now() - cache.t < VIGENCIA) return Promise.resolve(cache.crudos);
    if (enCurso && enCurso.clave === clave) return enCurso.p;
    const p = api.get('/agendas-v2/estadisticas', { skipBugReport: true }).then(({ data }) => {
        const crudos = data && Array.isArray(data.leads) ? data.leads : [];
        cache = { t: Date.now(), clave, crudos };
        return crudos;
    }).finally(() => { if (enCurso && enCurso.p === p) enCurso = null; });
    enCurso = { clave, p };
    return p;
}

// El nombre del link por el que entró (?o=): el de su procedencia en el funnel, o el slug tal cual.
function nombreDeOrigen(d, ev, origen) {
    if (!origen) return 'Directo';
    const e = buscar(d, 'eventos', ev), f = e && buscar(d, 'funnels', e.funnel);
    const o = f ? (f.origenes || []).find(x => (slugify(nombreOrigen(d, x)) || x.id) === origen) : null;
    return o ? nombreOrigen(d, o) : origen;
}

export function normalizarLeads(d, crudos) {
    return crudos.map(l => {
        const h = l.inicio != null ? new Date(l.inicio) : null;
        return {
            ...l, origen: nombreDeOrigen(d, l.ev, l.origen),
            // El horario de la agenda en la zona de quien mira.
            hora: h ? h.getHours() : null, dow: h ? h.getDay() : null,
        };
    });
}

/** {leads, ejemplo, cargando, error}. leads null mientras carga o sin eventos. */
export function useLeads() {
    const { d, reservas } = useDatos();
    const clave = MODO_LOCAL ? '' : String(reservas.length) + '/' + (reservas.length ? reservas[reservas.length - 1].id : '');
    const [est, setEst] = useState({ clave: null, crudos: null, error: false });

    useEffect(() => {
        if (MODO_LOCAL) return undefined;
        let vivo = true;
        traer(clave).then(
            crudos => { if (vivo) setEst({ clave, crudos, error: false }); },
            () => { if (vivo) setEst(x => ({ ...x, clave, error: true })); },
        );
        return () => { vivo = false; };
    }, [clave]);

    const leads = useMemo(() => {
        if (MODO_LOCAL) { const x = datosEjemplo(d); return x ? x.leads : null; }
        return est.crudos ? normalizarLeads(d, est.crudos) : null;
    }, [d, est.crudos]);

    return { leads, ejemplo: MODO_LOCAL, cargando: !MODO_LOCAL && !est.crudos && !est.error, error: est.error };
}

// Alcance por paso de un evento en los últimos 30 días, para el mapa de calor del flujo.
// reach: [0] entraron (null con datos reales: no se cuenta), [1] contacto, [2..n+1] preguntas,
// [n+2] llegaron al calendario, [n+3] agendaron.
export function reachEvento(d, e, leads, ahora = Date.now()) {
    const fo = buscar(d, 'formularios', e.formulario), n = fo ? fo.preguntas.length : 0, desde = ahora - 30 * DIA;
    const ls = leads.filter(l => l.ev === e.id && l.t >= desde);
    const reach = [];
    for (let i = 0; i <= n + 3; i++) reach.push(ls.filter(l => l.agenda || l.llego >= i).length);
    if (!MODO_LOCAL) reach[0] = null;
    return reach;
}
