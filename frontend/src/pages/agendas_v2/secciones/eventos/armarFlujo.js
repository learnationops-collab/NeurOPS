// Arma el flujo de un evento (vista estilo ManyChat): nodos en columnas y aristas entre filas.
// Inicio → Contacto → una columna por pregunta → Función de ruteo (o Persona fija) → Prioridades → Agenda → Fin.

import { CONTACTO, ESTRATEGIAS, FIN_DEF, conOpciones } from '../../core/catalogos';
import { buscar, nombreGrupo, ord } from '../../core/datos';
import { linkEvento } from '../../core/eventos';

export const NW = 236, NGAP = 84, ROW0 = 90, ROWH = 36;

/**
 * Devuelve {nodos, aristas, W, H, cuello, max}.
 * Nodo: {id, col, x, y, h, tipo, c, ico, tit, var_, filas:[{t, pts?, no?}], calor, q?, g?}
 * Arista: [origen, fila, destino, tipo?] con tipo 'no' | 'fn' | 'ok' | 'g' | undefined.
 * `reach` sale de statsEvento: [entraron, contacto, …preguntas, calendario, agendaron].
 */
export function armarFlujo(d, e, reach, calor) {
    const fo = buscar(d, 'formularios', e.formulario), f = buscar(d, 'funnels', e.funnel);
    const nodos = [], aristas = [];
    let col = 0;
    const nodo = (o) => {
        o.x = 40 + o.col * (NW + NGAP);
        o.filas = o.filas || [];
        o.h = ROW0 + o.filas.length * ROWH + 4 + (calor && o.calor != null ? 36 : 0);
        nodos.push(o);
        return o;
    };
    const unir = (prev, destino) => prev.forEach(p => p.filas.forEach((r, i) => { if (!r.no) aristas.push([p, i, destino]); }));
    const r = (i) => (reach ? reach[i] : null);
    const rFin = (k) => (reach ? reach[reach.length - k] : null);

    const n0 = nodo({ id: 'inicio', col: col++, y: 60, tipo: 'Inicio', c: 'var(--brand-secondary)', ico: 'link', tit: f ? f.nombre : 'Sin funnel', filas: [{ t: linkEvento(d, e) }], calor: r(0) });
    let prev = [n0];
    if (fo) {
        const nc = nodo({
            id: 'contacto', col: col++, y: 60, tipo: 'Contacto', c: 'var(--info)', ico: 'user', tit: 'Datos de contacto',
            filas: CONTACTO.map(c => ({ t: c.n + (fo.contacto[c.k] ? '' : ' (opcional)') })), calor: r(1),
        });
        prev.forEach(p => p.filas.forEach((_, i) => aristas.push([p, i, nc])));
        prev = [nc];
        fo.preguntas.forEach((q, k) => {
            let filas = conOpciones(q.tipo)
                ? q.opciones.filter(o => o.texto.trim()).map(o => ({ t: o.texto, pts: q.peso && o.puntos != null ? o.puntos : null, no: o.descalifica }))
                : [{ t: 'Al responder' }];
            if (!filas.length) filas = [{ t: 'Al responder' }];
            const nq = nodo({
                id: 'q-' + q.id, q: q.id, col: col++, y: 60, tipo: 'Pregunta', c: 'var(--info)', ico: 'lista', tit: q.titulo || 'Pregunta sin escribir',
                var_: q.peso ? '×' + q.peso : '', filas, calor: r(2 + k),
            });
            unir(prev, nq);
            prev = [nq];
        });
    }
    const hayNo = () => nodos.some(n => n.filas.some(x => x.no));
    const nodoNo = (ref) => {
        const nn = nodo({ id: 'no', col: ref.col, y: ref.y + ref.h + 70, tipo: 'Fin', c: 'var(--error)', ico: 'prohibido', tit: fo ? fo.fin.titulo : FIN_DEF.titulo, filas: [], calor: null });
        nodos.forEach(n => n.filas.forEach((x, i) => { if (x.no) aristas.push([n, i, nn, 'no']); }));
    };
    const cierre = (desde) => {
        const na = nodo({ id: 'agenda', col: col++, y: 60, tipo: 'Agenda', c: 'var(--success)', ico: 'calendar', tit: 'Elegí día y horario', var_: e.duracion + ' min', filas: [{ t: 'Llamada agendada' }], calor: rFin(1) });
        desde.forEach(g => g.filas.forEach((_, i) => aristas.push([g, i, na, 'g'])));
        const nf = nodo({ id: 'fin', col: col++, y: 60, tipo: 'Fin', c: 'var(--success)', ico: 'check', tit: 'Tu sesión quedó agendada', filas: [] });
        aristas.push([na, 0, nf, 'ok']);
    };

    if (e.persona) {
        const pp = buscar(d, 'personas', e.persona);
        const np = nodo({
            id: 'persona', col: col++, y: 60, tipo: 'Persona fija', c: 'var(--warning)', ico: 'user', tit: pp ? pp.nombre : 'Sin persona',
            var_: pp ? 'Top ' + pp.nivel : '', filas: [{ t: 'Link directo, sin rotación' }], calor: rFin(2),
        });
        unir(prev, np);
        if (hayNo()) nodoNo(np);
        cierre([np]);
    } else {
        const rutas = fo
            ? fo.reglas.map((rg, i) => ({ t: 'Regla ' + (i + 1) + ' → ' + nombreGrupo(d, rg.grupo), g: rg.grupo })).concat([{ t: 'Todo lo demás → ' + nombreGrupo(d, fo.resto), g: fo.resto }])
            : [{ t: 'Todos', g: '' }];
        const nf = nodo({ id: 'calif', col: col++, y: 60, tipo: 'Función', c: 'var(--brand-secondary)', ico: 'rayo', tit: 'Elegir prioridad por respuestas', filas: rutas.map(x => ({ t: x.t })), calor: rFin(2) });
        unir(prev, nf);
        if (hayNo()) nodoNo(nf);
        const gcol = col++, ngs = [], porG = {}, grupos = ord(d, 'grupos');
        let gy = 60;
        rutas.forEach((rt, i) => {
            if (porG[rt.g]) { aristas.push([nf, i, porG[rt.g], 'fn']); return; }
            const g = buscar(d, 'grupos', rt.g);
            const ms = g ? g.miembros.map(id => buscar(d, 'personas', id)).filter(Boolean) : [];
            const ng = nodo({
                id: 'g-' + (g ? g.id : i), g: g ? g.id : null, col: gcol, y: gy, tipo: 'Prioridad ' + (g ? grupos.indexOf(g) + 1 : ''), c: 'var(--warning)', ico: 'users',
                tit: g ? g.nombre : 'Sin prioridad', var_: g ? ESTRATEGIAS[g.estrategia] : '',
                filas: ms.length ? ms.map((p, j) => ({ t: (j + 1) + '. ' + p.nombre, pts: 'Top ' + p.nivel })) : [{ t: 'Sin closers' }],
            });
            aristas.push([nf, i, ng, 'fn']);
            ngs.push(ng);
            porG[rt.g] = ng;
            gy = ng.y + ng.h + 26;
        });
        cierre(ngs);
    }

    // Cuello de botella: la mayor caída entre pasos seguidos.
    let cuello = null;
    if (reach) {
        let peor = 0;
        const seq = nodos.filter(n => n.calor != null);
        for (let i = 1; i < seq.length; i++) { const caida = seq[i - 1].calor - seq[i].calor; if (caida > peor) { peor = caida; cuello = seq[i].id; } }
    }
    let W = 0, H = 0;
    nodos.forEach(n => { W = Math.max(W, n.x + NW + 40); H = Math.max(H, n.y + n.h + 50); });
    return { nodos, aristas, W, H, cuello, max: reach ? reach[0] || 1 : 1 };
}

// Curva de una arista: sale de la fila del origen y entra por la cabecera del destino.
export function caminoArista(a) {
    const [p, i, t, tipo] = a;
    const x1 = p.x + NW, y1 = p.y + (p.filas.length ? ROW0 + i * ROWH + 15 : 17), x2 = t.x, y2 = t.y + 17;
    const c = tipo === 'no' ? 'var(--error)' : tipo === 'fn' ? 'var(--brand-secondary)' : tipo === 'ok' ? 'var(--success)' : 'var(--arista)';
    const dx = Math.max(40, (x2 - x1) / 2);
    return { x1, y1, x2, y2, c, d: 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ',' + (x2 - dx) + ' ' + y2 + ',' + x2 + ' ' + y2 };
}
