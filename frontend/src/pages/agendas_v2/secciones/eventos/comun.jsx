// Piezas compartidas por la lista, el detalle y el flujo de un evento.

import { useState } from 'react';
import { buscar, nombreOrigen } from '../../core/datos';
import { linkEvento } from '../../core/eventos';
import { slugify } from '../../core/util';
import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import { copiarTexto } from '../../ui/toast';

// Slug de un origen en el link (?o=...): el nombre del setter o del origen.
export function slugOrigen(d, o) { return slugify(nombreOrigen(d, o)) || o.id; }

// Dirección pública completa del evento (lo que se pega en un anuncio o se manda por WhatsApp).
export function urlPublica(d, e, o) {
    return window.location.origin + '/agendas-v2' + linkEvento(d, e) + (o ? '?o=' + slugOrigen(d, o) : '');
}
export function copiarLink(d, e, o) { copiarTexto(urlPublica(d, e, o)); }

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
