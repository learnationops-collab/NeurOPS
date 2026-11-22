// La Guía del setting (ADR-W197): lo que el setter manda en cada fase. Se pide una vez y la comparten la
// sección Guía, el chat (el guión al pasar de fase y el «/») y la tarjeta del lead. Publicar la refresca para todos.
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { inboxApi } from '../api';
import { siguiente } from '../conversaciones/fasesSetting';

let cache = null;
let pedido = null;
const subs = new Set();

export function fijarGuia(datos) {
    cache = datos;
    subs.forEach((f) => f(datos));
}

export function cargarGuia() {
    if (!pedido) {
        pedido = inboxApi.guia().then(fijarGuia, () => fijarGuia({ error: true })).finally(() => { pedido = null; });
    }
    return pedido;
}

/** La guía vigente ({version, contenido, uso, puede_aprobar…}); null mientras carga. */
export function useGuia() {
    const [g, setG] = useState(cache);
    useEffect(() => {
        subs.add(setG);
        if (!cache) cargarGuia();
        return () => subs.delete(setG);
    }, []);
    return g;
}

// El primer link de agenda del setter, para {link de agenda}. Quien no es setter no tiene: queda la variable.
let link = null;
export function useLinkAgenda() {
    const [l, setL] = useState(link);
    useEffect(() => {
        if (link !== null) return;
        api.get('/setter/agendas-links').then((r) => {
            const primero = Array.isArray(r?.data?.links) ? r.data.links[0] : null;
            link = primero ? window.location.origin + primero.ruta : '';
            setL(link);
        }, () => { link = ''; setL(''); });
    }, []);
    return l;
}

export const LETRAS = 'ABCDEF';
export const USOS = [
    { value: '', label: 'Siempre' },
    { value: 'solo si', label: 'Solo si…' },
    { value: 'opcional', label: 'Opcional' },
    { value: 'no se usa', label: 'No se usa' },
];

export const pasosDe = (guia, fase) => guia?.contenido?.etapas?.[fase]?.pasos || [];
export const notaDe = (guia, fase) => guia?.contenido?.etapas?.[fase]?.nota || '';
/** La fase a la que pasa el lead con un paso que «pasa a la siguiente». */
export const siguienteId = (fase) => siguiente(fase)?.id || null;
export const visibles = (pasos) => pasos.filter((p) => p.uso !== 'no se usa');
export const rotulo = (p, j) => (p.porRespuesta ? `Si eligió ${p.op[j]?.si || '…'}` : p.op.length > 1 ? `Opción ${LETRAS[j]}` : 'Mensaje');
export const claveDe = (fase, p, j) => `${fase}:${p.id}:${j}`;
export const nuevoId = () => Math.random().toString(36).slice(2, 8);
/** Una línea en blanco separa los mensajes. */
export const partes = (t) => String(t || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
/** Lo que va entre [corchetes] lo escribe el setter: si queda alguno, no se manda. */
export const faltaCompletar = (t) => /\[[^\]]+\]/.test(t || '');

/** {nombre}, {link de agenda} y las variables del lead completadas; lo que no se sabe queda como está. */
export function completarGuia(texto, contacto, linkAgenda) {
    const vars = contacto?.variables || {};
    const nombre = String(vars.nombre || contacto?.nombre || '').trim().split(/\s+/)[0];
    return String(texto || '')
        .replace(/\{link de agenda\}/g, (m) => linkAgenda || m)
        .replace(/\{(\w+)\}/g, (m, k) => {
            if (k === 'nombre' && nombre) return nombre;
            const v = vars[k];
            return v == null || v === '' ? m : String(v);
        });
}

/** {enviados, respondidos, pct} de una opción en los últimos días, o null si no se mandó. */
export function usoDe(guia, clave) {
    const u = guia?.uso?.[clave];
    if (!u || !u.enviados) return null;
    return { ...u, pct: Math.round((100 * u.respondidos) / u.enviados) };
}
