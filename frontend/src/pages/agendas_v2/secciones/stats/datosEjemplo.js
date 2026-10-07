// Datos de ejemplo para Stats y el mapa de calor del flujo en modo local (tests, VITE_AGENDAS_LOCAL).
// Son sintéticos y deterministas (misma semilla, mismos números). Con la API, los reales: leads.js.
// Cada lead: {t, ev, llego, desc, agenda, score, closer, setter, origen, grupo, hora, dow}.
// `llego`: 0 entró, 1 dejó el contacto, 2..n+1 respondió cada pregunta, n+2 llegó al calendario, n+3 agendó.

import { conOpciones } from '../../core/catalogos';
import { buscar, closers, esCloser, nombreOrigen, ord, setters } from '../../core/datos';
import { grupoPorReglas } from '../../core/formulario';

const DIA = 86400000;
function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; s ^= s >>> 12; return (s >>> 0) / 4294967296; };
}

let cache = null;
export function datosEjemplo(d, ahora = Date.now()) {
    const es = ord(d, 'eventos');
    if (!es.length) return null;
    const firma = JSON.stringify([
        es.map(e => [e.id, e.formulario, e.persona, e.funnel]), d.funnels.map(f => [f.id, f.origenes]),
        d.formularios.map(f => [f.id, f.preguntas.length, f.reglas, f.resto]), d.personas.map(p => [p.id, p.rol]),
        Math.floor(ahora / DIA),
    ]);
    if (cache && cache.firma === firma) return cache;
    const r = rng(20261002), leads = [], sts = setters(d), cls = closers(d);
    const setNames = sts.length ? sts.map(s => s.nombre) : ['Setter 1', 'Setter 2', 'Setter 3'];
    es.forEach((e, ei) => {
        const fo = buscar(d, 'formularios', e.formulario), fu = buscar(d, 'funnels', e.funnel), qs = fo ? fo.preguntas : [];
        const esSetting = fu && /setting/i.test(fu.nombre);
        for (let dd = 0; dd < 180; dd++) {
            const ts0 = ahora - dd * DIA, dow = new Date(ts0).getUTCDay(), base = (dow === 0 || dow === 6 ? 2 : 5) - ei * 0.8 + (dd < 30 ? 1 : 0);
            const n = Math.max(0, Math.round(base + (r() - 0.5) * 4));
            for (let k = 0; k < n; k++) {
                const ors = fu ? fu.origenes : [], org = ors.length && r() < 0.85 ? ors[Math.floor(r() * ors.length)] : null, orgP = org && org.setter && buscar(d, 'personas', org.setter);
                const lead = {
                    t: ts0 - Math.floor(r() * DIA), ev: e.id, llego: 0, desc: false, agenda: false, score: null, closer: null,
                    setter: orgP ? orgP.nombre : esSetting && !ors.length ? setNames[Math.floor(r() * setNames.length)] : null,
                    origen: org ? nombreOrigen(d, org) : 'Directo', grupo: null, hora: 9 + Math.floor(r() * 12), dow: Math.floor(r() * 7),
                };
                if (r() > 0.9) { leads.push(lead); continue; }
                lead.llego = 1;
                let num = 0, den = 0, corto = false;
                const resp = {};
                for (let j = 0; j < qs.length; j++) {
                    if (r() > 0.95 - j * 0.008 - (qs[j].titulo.length > 80 ? 0.05 : 0)) { corto = true; break; }
                    lead.llego = 2 + j;
                    const q = qs[j], ops = q.opciones.filter(o => o.texto.trim());
                    if (conOpciones(q.tipo) && ops.length) {
                        const o = ops[Math.min(ops.length - 1, Math.floor(Math.pow(r(), 0.8) * ops.length))];
                        resp[q.id] = o.id;
                        if (o.descalifica && r() < 0.7) { lead.desc = true; corto = true; break; }
                        if (q.peso && o.puntos != null) { num += q.peso * o.puntos; den += q.peso * 10; }
                    }
                }
                if (den) lead.score = Math.round(num / den * 100) / 10;
                if (corto) { leads.push(lead); continue; }
                lead.llego = 2 + qs.length;
                if (r() < 0.8) {
                    lead.agenda = true; lead.llego++;
                    const g = e.persona ? null : buscar(d, 'grupos', grupoPorReglas(fo, resp).grupo);
                    lead.grupo = g ? g.id : null;
                    const ms = g ? g.miembros.map(id => buscar(d, 'personas', id)).filter(p => p && esCloser(d, p)) : (e.persona ? [buscar(d, 'personas', e.persona)].filter(Boolean) : cls);
                    if (ms.length) lead.closer = (g && g.estrategia !== 'repartir' && r() < (g.estrategia === 'llenar' ? 0.65 : 0.5) ? ms[0] : ms[Math.floor(r() * ms.length)]).id;
                }
                leads.push(lead);
            }
        }
    });
    cache = { firma, leads };
    return cache;
}

