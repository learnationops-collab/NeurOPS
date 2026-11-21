/**
 * «Copiar motivos para IA» (ADR-W190): los motivos de las agendas filtradas, dentro de un pedido listo para
 * pegar en cualquier IA. Sin nombre ni contacto del lead (decisión de Kerwin, 20/11/2026): fecha, estado,
 * closer, fuente, segmento, país, contacto de seguimiento y el motivo.
 */
import { contactoDe } from '../tablasDef';

/** El motivo de una agenda y su tipo, o null si no tiene uno escrito. */
export const motivoDe = (f) => {
    const clave = f.post_call?.key;
    if (f.motivo_no_cierre?.texto) {
        return { tipo: 'No cerró', texto: f.motivo_no_cierre.texto,
            extra: f.motivo_no_cierre.oferta_presentada ? 'con oferta' : 'sin oferta' };
    }
    const texto = f.motivo?.texto;
    // La nota automática de una cancelación en Google no es un motivo (ADR-W191).
    if (!texto || f.motivo.falta) return null;
    const tipo = clave === 'no_show' ? 'No show' : clave === 'reagendo' ? 'Reprogramó' : 'Canceló';
    return { tipo, texto, extra: f.motivo.auto ? 'nota automática' : null };
};

const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim();

/** Cuántos motivos hay de cada tipo, en el orden en que se muestran. */
export const conteoPorTipo = (motivos) => ['No show', 'Canceló', 'Reprogramó', 'No cerró']
    .map(tipo => ({ tipo, n: motivos.filter(m => m.tipo === tipo).length }))
    .filter(t => t.n > 0);

/** `[{fila, tipo, texto, extra}]` de las filas que tienen motivo, de la más nueva a la más vieja. */
export const motivosDe = (filas) => filas
    .map(f => ({ fila: f, ...(motivoDe(f) || {}) }))
    .filter(m => m.texto)
    .sort((a, b) => String(b.fila.fecha).localeCompare(String(a.fila.fecha)));

/** La línea de un motivo, sin datos personales. */
export const lineaDe = ({ fila: f, tipo, texto, extra }) => [
    fecha(f.fecha), tipo, f.closer, f.fuente, f.segmento === 'sin' ? 'sin segmento' : `segmento ${f.segmento || '—'}`,
    f.pais_nombre || 'sin país', contactoDe(f) ? `seguimiento: ${contactoDe(f).toLowerCase()}` : null,
    extra, `«${limpio(texto)}»`,
].filter(Boolean).join(' · ');

/** El pedido completo: instrucciones, el filtro con el que se miró y una línea por motivo. */
export const armarPrompt = (motivos, { alcance, criterios }) => {
    const filtro = criterios.length
        ? criterios.map(c => `${c.faceta}: ${c.valor}`).join('; ')
        : 'sin filtro (todas las agendas del período)';
    return [
        'Sos analista comercial de un equipo de ventas por llamada (programas para médicos que preparan su examen de residencia).',
        `Abajo van ${motivos.length} motivos escritos por el equipo sobre agendas que no terminaron en venta: no show, cancelación, reprogramación y llamadas con show up que no cerraron.`,
        '',
        'Necesito que:',
        '1. Agrupes los motivos por causa y cuentes cuántos hay en cada una (de mayor a menor).',
        '2. Separes lo que depende de la confirmación y el contacto previo de lo que depende del lead (dinero, tiempo, interés).',
        '3. Marques diferencias por closer, fuente, segmento o país si las hay, con los números.',
        '4. Propongas 3 acciones concretas, ordenadas por impacto.',
        'Citá textual los motivos que mejor representan cada causa. Si un motivo no dice nada útil, contalo aparte.',
        '',
        `Período y alcance: ${alcance}. Filtro: ${filtro}.`,
        'Formato de cada línea: fecha · tipo · closer · fuente · segmento · país · seguimiento · detalle · «motivo».',
        '---',
        ...motivos.map(lineaDe),
    ].join('\n');
};
