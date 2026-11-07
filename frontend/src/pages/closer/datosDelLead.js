// Datos del lead que se leen del formulario para las tarjetas del mazo (Confirmar, Reportar y el
// embudo de Seguir). Salieron de CloserWorkflowPage para usarlos en más de una tarjeta.

// La inversión del formulario en pocas palabras, para la tarjeta: «Entre $200 y $500 USD.» →
// «$200–500 USD», «Más de 1000 USD» → «+$1.000 USD» y cualquier forma de «no puedo» → «Sin
// inversión» (pedido del 23/10/2026). El texto completo queda en el `title`.
const milesAr = (n) => Number(n).toLocaleString('es-AR');
export const inversionCorta = (txt) => {
    const t = String(txt || '').trim().replace(/\.$/, '');
    if (/\b(no\s+(puedo|estoy|tengo|cuento|dispongo)|ninguna|nada|sin\s+(inversi|presupuesto|dinero))/i.test(t)) return { texto: 'Sin inversión', sin: true };
    const nums = (t.match(/\d[\d.,]*/g) || []).map(x => Number(x.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))).filter(n => n > 0);
    const usd = /usd|d[oó]lar/i.test(t) ? ' USD' : '';
    if (nums.length >= 2) return { texto: `$${milesAr(nums[0])}–${milesAr(nums[1])}${usd}` };
    if (nums.length === 1) {
        const signo = /m[aá]s\s+de|desde|\+/i.test(t) ? '+' : /menos\s+de|hasta/i.test(t) ? '<' : '';
        return { texto: `${signo}$${milesAr(nums[0])}${usd}` };
    }
    return { texto: t.length > 22 ? `${t.slice(0, 21)}…` : t };
};

// Si decide solo o necesita a alguien más, sacado del formulario: la pregunta que habla de
// decidir, de acompañamiento o de quién paga. Sin una pregunta así, no se muestra nada.
export const decisionDe = (a) => {
    const fd = a.form_data && typeof a.form_data === 'object' ? a.form_data : {};
    const clave = Object.keys(fd).find(k => /decisi|decid|acompa|qui[eé]n\s+(paga|financ|apoya)|apoyo/i.test(k));
    const v = clave ? String(fd[clave] ?? '').trim() : '';
    if (!v) return null;
    if (/pareja|familia|padre|madre|espos|consult|acompa|otra persona|alguien|junto|no\b/i.test(v)) {
        return { texto: 'No decisor', solo: false, title: v };
    }
    if (/yo\b|solo|sola|m[ií] mism|por mi cuenta|s[ií]\b/i.test(v)) return { texto: 'Decisor', solo: true, title: v };
    return { texto: v.length > 20 ? `${v.slice(0, 19)}…` : v, solo: null, title: v };
};

// Color del segmento en la tarjeta: A y B son los que más importan, C y D los que se pueden desplazar.
export const TONO_SEGMENTO = { A: 'var(--cl-success)', B: 'var(--cl-info)', C: 'var(--cl-warning)', D: 'var(--cl-magenta)' };
export const fmtPuntos = (n) => (Number(n) > 0 ? '+' : '') + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });

// Lo que el lead dijo que puede invertir en el formulario de calificación: la clave `inversion`
// del formulario viejo (n8n) o, en uno de Agendas 2.0, la pregunta que habla de invertir. Un
// número suelto se muestra como monto; un rango o un texto, tal cual.
export const inversionDe = (a) => {
    const fd = a.form_data && typeof a.form_data === 'object' ? a.form_data : {};
    let v = fd.inversion;
    if (!v) {
        const clave = Object.keys(fd).find(k => /invert|inversi|presupuesto/i.test(k));
        v = clave ? fd[clave] : null;
    }
    if (v == null || String(v).trim() === '') return null;
    const txt = String(v).trim();
    const n = Number(txt.replace(/[$\s,.]/g, ''));
    return /^\$?\s*[\d.,]+\s*(usd)?$/i.test(txt) && n > 0 ? `$${n.toLocaleString('es-AR')}` : txt;
};
