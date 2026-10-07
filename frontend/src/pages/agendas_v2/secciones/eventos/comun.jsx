// Piezas compartidas por la lista, el detalle y el flujo de un evento.

import { useEffect, useState } from 'react';
import { buscar, nombreOrigen } from '../../core/datos';
import { linkEvento, pasosAgendamiento } from '../../core/eventos';
import { slugify } from '../../core/util';
import { almacen } from '../../data/hooks';
import { Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { copiarTexto } from '../../ui/toast';

// Slug de un origen en el link (?o=...): el nombre del setter o del origen.
export function slugOrigen(d, o) { return slugify(nombreOrigen(d, o)) || o.id; }

// Dirección pública completa del evento (lo que se pega en un anuncio o se manda por WhatsApp).
export function urlPublica(d, e, o) {
    return window.location.origin + '/agendas-v2' + linkEvento(d, e) + (o ? '?o=' + slugOrigen(d, o) : '');
}
export function copiarLink(d, e, o) { copiarTexto(urlPublica(d, e, o)); }

// Setters activos de la app (cada uno tiene su link en los funnels de setting). null mientras carga;
// [] en modo local o si falla. Se piden una vez y se comparten entre las tarjetas.
let settersCache = null;
export function useSetters() {
    const [lista, setLista] = useState(settersCache);
    useEffect(() => {
        if (settersCache) return undefined;
        let vivo = true;
        Promise.resolve(almacen.adaptador.usuarios ? almacen.adaptador.usuarios('setter') : [])
            .then(u => { settersCache = u; if (vivo) setLista(u); }, () => { if (vivo) setLista([]); });
        return () => { vivo = false; };
    }, []);
    return lista;
}
export const urlSetter = (d, e, s) => window.location.origin + '/agendas-v2' + linkEvento(d, e) + '?o=' + slugify(s.nombre);

/**
 * «Links de setters» de un evento de un funnel de setting: uno por setter, para copiar y mandar.
 * La agenda que entra por ese link queda a nombre del setter.
 */
export function LinksSetters({ d, e, compacto = false }) {
    const sts = useSetters();
    const lista = sts === null ? <span className="t-sm mut">Cargando setters…</span>
        : !sts.length ? <span className="t-sm mut">No hay setters activos en la app.</span>
            : sts.map(s => (
                <button key={s.id} type="button" className="ls-b" data-nav="" title={'Copiar ' + urlSetter(d, e, s)}
                    aria-label={'Copiar link de ' + s.nombre} onClick={() => copiarTexto(urlSetter(d, e, s), 'Link de ' + s.nombre + ' copiado')}>
                    <b>{s.nombre}</b>{!compacto && <span>?o={slugify(s.nombre)}</span>}<Icono n="copiar" s={13} />
                </button>
            ));
    return (
        <div className={'ls' + (compacto ? ' ls--compacto' : '')}>
            <span className="ls-tit"><Icono n="users" s={14} />Links de setters</span>
            <div className="ls-lista">{lista}</div>
        </div>
    );
}

// A dónde lleva cada paso pendiente de un evento: el equipo a las estrategias de Team; un formulario
// sin segmentación, a su segmentación; lo demás, al evento.
function irAlPaso(d, e, k, ok) {
    const fo = buscar(d, 'formularios', e.formulario);
    almacen.flush();
    if (k === 'equipo') { ui.set(s => ({ seccion: 'team', team: { ...s.team, tab: 'grupos' } })); return; }
    if (k === 'formulario' && fo && !ok) { ui.set({ seccion: 'preguntas', form: { id: fo.id, vista: 'ruteo', sel: null } }); return; }
    abrirEvento(e.id);
}

// Lo que le falta a un evento para recibir agendas (solo lo pendiente); tocarlo lleva a resolverlo.
export function PasosPendientes({ d, e }) {
    const pend = pasosAgendamiento(d, e).filter(p => !p.ok);
    if (!pend.length) return null;
    return (
        <ol className="fu-pasos" aria-label={'Lo que le falta a ' + e.nombre}>
            {pend.map(p => (
                <li key={p.k}>
                    <button type="button" className="fu-paso" title={p.det} onClick={() => irAlPaso(d, e, p.k, p.ok)}>
                        <Icono n="alerta" s={13} />{p.n}
                    </button>
                </li>
            ))}
        </ol>
    );
}

export function abrirEvento(id) {
    almacen.flush();
    ui.set({ seccion: 'eventos', ev: { id, tab: 'config', nodo: null, calor: true } });
    window.scrollTo({ top: 0 });
}

export function probarEvento(d, e) {
    almacen.flush();
    ui.set({ prueba: { evento: e, form: buscar(d, 'formularios', e.formulario) || null } });
}

// Qué pasa con los leads de una prioridad, en una línea.
export function textoEstrategia(d, g) {
    const ns = g.miembros.map(id => { const p = buscar(d, 'personas', id); return p ? p.nombre : ''; }).filter(Boolean);
    if (!ns.length) return 'Sumá closers.';
    if (ns.length === 1) return 'Todo va a ' + ns[0] + '.';
    if (g.estrategia === 'repartir') return 'Cada closer recibe su porcentaje de las agendas.';
    if (g.estrategia === 'horario') return 'El lead ve los horarios de todos; cada uno va a ' + ns[0] + ' y, si está ocupado, a ' + ns[1] + (ns.length > 2 ? ' y así.' : '.');
    return ns[0] + ' hasta llenar su agenda, después ' + ns[1] + (ns.length > 2 ? ' y así.' : '.');
}

export function EstadoEv({ est }) {
    return <span className="estado-ev" style={{ '--c': est.c }}><i />{est.n}</span>;
}

/**
 * Campo de texto que guarda mientras se escribe, pero muestra lo escrito tal cual hasta salir del
 * campo (así un valor que se normaliza, como un slug o un nombre vacío, no salta bajo el cursor).
 * `guardar(texto)` decide qué se guarda; si devuelve false, el campo queda marcado como inválido.
 */
export function useBorrador(valor) {
    const [txt, setTxt] = useState(null);
    return {
        value: txt != null ? txt : valor,
        escribiendo: txt != null,
        set: setTxt,
        soltar: () => setTxt(null),
    };
}

export function InputVivo({ valor, guardar, className = 'input', ...rest }) {
    const b = useBorrador(valor);
    const [mal, setMal] = useState(false);
    return (
        <input
            {...rest}
            className={className + (mal ? ' mal' : '')}
            value={b.value}
            onChange={ev => { const t = ev.target.value; b.set(t); setMal(guardar(t) === false); }}
            onBlur={() => { b.soltar(); setMal(false); almacen.flush(); }}
        />
    );
}
