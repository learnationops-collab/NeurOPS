// Lógica pura de las campañas: en qué estado está, cómo se muestran sus fechas y cómo se arma lo que
// se manda al servidor. La vigencia del servidor es [desde, hasta): acá «hasta» es el último día
// incluido, así que al guardar se manda el día siguiente a la medianoche local.

export const EMBUDOS = [
    { value: 'setting', label: 'Setting' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'vsl', label: 'VSL' },
    { value: 'otro', label: 'Otro' },
];
export const TIPOS = [{ value: 'pago', label: 'Pago' }, { value: 'organico', label: 'Orgánica' }];
export const REPARTOS = [{ value: 'distribuido', label: 'Distribuido' }, { value: 'sin_reparto', label: 'Sin reparto' }];
export const ESTADOS = {
    vigente: { texto: 'Vigente', color: 'var(--success)' },
    proxima: { texto: 'Próxima', color: 'var(--info)' },
    terminada: { texto: 'Terminada', color: 'var(--idle)' },
};

const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function estadoDe(c, ahora = new Date()) {
    if (new Date(c.desde) > ahora) return 'proxima';
    if (c.hasta && new Date(c.hasta) <= ahora) return 'terminada';
    return 'vigente';
}

// 'YYYY-MM-DD' local de un instante ISO; el «hasta» exclusivo se muestra como su día anterior.
export function diaLocal(iso, finExclusivo = false) {
    if (!iso) return '';
    const d = new Date(iso);
    if (finExclusivo) d.setMinutes(d.getMinutes() - 1);
    return dia(d);
}

const medianoche = (yyyyMmDd, masDias = 0) => {
    const [a, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(a, m - 1, d + masDias).toISOString();
};

export function fechasLegibles(c) {
    const f = (yyyyMmDd) => new Date(`${yyyyMmDd}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' });
    const desde = f(diaLocal(c.desde));
    return c.hasta ? `${desde} – ${f(diaLocal(c.hasta, true))}` : `Desde ${desde}, sin fin`;
}

// Lo que edita el formulario, a partir de una campaña del servidor (o vacío para una nueva).
export function formulario(c) {
    return {
        nombre: c?.nombre || '',
        embudo: c?.embudo || 'setting',
        tipo: c?.tipo || 'pago',
        flujo_id: c?.flujo_id ?? '',
        desde: c ? diaLocal(c.desde) : dia(new Date()),
        hasta: c?.hasta ? diaLocal(c.hasta, true) : '',
        palabras: c?.palabras || [],
        campanas_meta: c?.campanas_meta || [],
        reparto: c?.reparto || 'distribuido',
        solo_conectados: !!c?.solo_conectados,
        setters: c?.setters || [],
        // Cuánto recibe cada setter respecto de los demás, por id (texto: es lo que se escribe en el campo).
        pesos: Object.fromEntries(Object.entries(c?.pesos || {}).map(([id, p]) => [id, String(p)])),
    };
}

export const PESO_MAX = 100;
const pesoValido = (p) => Number.isInteger(Number(p)) && Number(p) >= 1 && Number(p) <= PESO_MAX && String(p).trim() !== '';

// El peso con el que entra un setter que se suma: el menor de los que ya están (parejo si todos son iguales).
export function pesoInicial(f) {
    const actuales = f.setters.map((id) => Number(f.pesos[id])).filter((p) => pesoValido(p));
    return String(actuales.length ? Math.min(...actuales) : 1);
}

// Porcentaje que le toca a cada setter elegido: {id: 70, ...}.
export function porcentajes(ids, pesos) {
    const peso = (id) => (pesoValido(pesos[id] ?? 1) ? Number(pesos[id] ?? 1) : 0);
    const total = ids.reduce((suma, id) => suma + peso(id), 0);
    return Object.fromEntries(ids.map((id) => [id, total ? Math.round((100 * peso(id)) / total) : 0]));
}

// Problemas que se ven antes de mandar; el servidor valida lo mismo y además los choques de palabras.
export function errorDe(f) {
    if (!f.nombre.trim()) return 'Escribí un nombre.';
    if (!f.desde) return 'Elegí desde qué día corre.';
    if (f.hasta && f.hasta < f.desde) return 'El último día no puede ser anterior al primero.';
    if (!f.palabras.length) return 'Agregá al menos una palabra clave.';
    if (f.reparto === 'distribuido' && f.setters.some((id) => !pesoValido(f.pesos[id] ?? 1))) {
        return `El peso de cada setter es un número entero de 1 a ${PESO_MAX}.`;
    }
    return null;
}

export function cuerpo(f) {
    return {
        nombre: f.nombre.trim(),
        embudo: f.embudo,
        tipo: f.tipo,
        flujo_id: f.flujo_id === '' ? null : Number(f.flujo_id),
        desde: medianoche(f.desde),
        hasta: f.hasta ? medianoche(f.hasta, 1) : null,
        palabras: f.palabras,
        campanas_meta: f.campanas_meta,
        reparto: f.reparto,
        solo_conectados: f.solo_conectados,
        setters: f.reparto === 'distribuido' ? f.setters : [],
        pesos: f.reparto === 'distribuido' ? Object.fromEntries(f.setters.map((id) => [String(id), Number(f.pesos[id] ?? 1)])) : {},
    };
}

// «Reparte entre Paula, Elias», «Reparte: Elias 70 % · Paula 30 %» (con pesos distintos) o «Sin reparto», para la tarjeta.
export function repartoLegible(c, setters) {
    if (c.reparto !== 'distribuido') return 'Sin reparto: lo ve todo el equipo';
    const ids = (c.setters || []).filter((id) => setters.some((s) => s.id === id));
    if (!ids.length) return 'Reparte entre todos los setters';
    const nombre = (id) => setters.find((s) => s.id === id).nombre;
    const pesos = Object.fromEntries(ids.map((id) => [id, String(c.pesos?.[id] ?? 1)]));
    if (new Set(Object.values(pesos)).size === 1) return `Reparte entre ${ids.map(nombre).join(', ')}`;
    const parte = porcentajes(ids, pesos);
    return `Reparte: ${ids.map((id) => `${nombre(id)} ${parte[id]} %`).join(' · ')}`;
}

// Una palabra nueva para la lista: sin espacios de más y sin repetir (sin tildes ni mayúsculas).
const clave = (t) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
export function sumarPalabra(lista, texto) {
    const limpio = texto.trim().replace(/\s+/g, ' ');
    if (!clave(limpio) || lista.some((p) => clave(p) === clave(limpio))) return lista;
    return [...lista, limpio];
}
