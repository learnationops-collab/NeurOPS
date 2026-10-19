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
    };
}

// Problemas que se ven antes de mandar; el servidor valida lo mismo y además los choques de palabras.
export function errorDe(f) {
    if (!f.nombre.trim()) return 'Escribí un nombre.';
    if (!f.desde) return 'Elegí desde qué día corre.';
    if (f.hasta && f.hasta < f.desde) return 'El último día no puede ser anterior al primero.';
    if (!f.palabras.length) return 'Agregá al menos una palabra clave.';
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
    };
}

// «Distribuido entre todos», «entre Paula y Elias» o «Sin reparto», para la tarjeta.
export function repartoLegible(c, setters) {
    if (c.reparto !== 'distribuido') return 'Sin reparto: lo ve todo el equipo';
    const nombres = (c.setters || []).map((id) => setters.find((s) => s.id === id)?.nombre).filter(Boolean);
    return nombres.length ? `Reparte entre ${nombres.join(', ')}` : 'Reparte entre todos los setters';
}

// Una palabra nueva para la lista: sin espacios de más y sin repetir (sin tildes ni mayúsculas).
const clave = (t) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
export function sumarPalabra(lista, texto) {
    const limpio = texto.trim().replace(/\s+/g, ' ');
    if (!clave(limpio) || lista.some((p) => clave(p) === clave(limpio))) return lista;
    return [...lista, limpio];
}
