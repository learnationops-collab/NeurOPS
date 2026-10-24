// El "@" y el menú "/" del chat de Learnito (ADR-W012): qué se está escribiendo, cómo se inserta lo elegido y cómo
// viaja al cerebro. Un cliente va como "@[Nombre, id N]" y alguien del equipo como "@[Nombre, equipo N]" (ADR-194 de
// la Academia); así el cerebro no tiene que buscarlos y las acciones simples se arman sin IA.

export const plano = (t) => (t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Lo que se está escribiendo antes del cursor: "/acc" al principio del mensaje, o "@nom" (desde dos letras y hasta
// cuatro palabras). null si no es ninguno.
export function disparador(valor, cursor) {
    const antes = (valor || '').slice(0, cursor);
    const barra = antes.match(/^\/(\S*)$/);
    if (barra) return { tipo: 'accion', inicio: 0, fin: cursor, termino: barra[1] };
    const m = antes.match(/(?:^|\s)@([^@\n[\]]{2,40})$/);
    if (!m || m[1].trim().split(/\s+/).length > 4) return null;
    return { tipo: 'arroba', inicio: cursor - m[1].length - 1, fin: cursor, termino: m[1].trim() };
}

export const filtrarAcciones = (acciones, termino) =>
    acciones.filter((a) => plano(`${a.clave} ${a.nombre}`).includes(plano(termino)));

// Pone lo elegido en el rango: una acción como "/clave ", una persona como "@Nombre ". Un texto seleccionado en una
// respuesta va al final del mensaje (`alFinal`). Devuelve {valor, cursor}.
export function insertar(valor, rango, item) {
    const separar = rango.alFinal && valor && !/\s$/.test(valor) ? ' ' : '';
    const texto = item.tipo === 'accion' ? `/${item.clave} ` : `${separar}@${item.nombre} `;
    const antes = valor.slice(0, rango.inicio) + texto;
    return { valor: antes + valor.slice(rango.fin), cursor: antes.length };
}

// Cada "@Nombre" que se eligió pasa al formato con su id; los nombres largos primero ("@Ana María" antes que "@Ana").
// Un nombre que se borró del texto no queda.
export function conMenciones(texto, nombrados) {
    return [...nombrados].sort((a, b) => b.nombre.length - a.nombre.length).reduce((t, n) => {
        const nombre = n.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return t.replace(new RegExp(`@${nombre}(?![^\\s.,;:!?)])`, 'gu'),
            `@[${n.nombre}, ${n.tipo === 'equipo' ? 'equipo' : 'id'} ${n.id}]`);
    }, texto);
}

// Para mostrar una pregunta: "@[Kevin, id 5]" queda "@Kevin".
export const sinIds = (texto) => (texto || '').replace(/@\[([^\]\n]+?), (?:id|equipo) \d+\]/gu, '@$1');

// Un texto seleccionado que se puede convertir en nombre: de 2 a 60 letras, en una sola línea y sin "@".
export const seleccionValida = (t) => t.length >= 2 && t.length <= 60 && !t.includes('\n') && !t.startsWith('@');
