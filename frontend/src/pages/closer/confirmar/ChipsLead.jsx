// Las etiquetas de color de una agenda (etapa, segmento, inversión, decisor, tipo, closer y el resto), con su
// ícono. Las usan el calendario de Confirmar y el riel del Workspace.
import { DollarSign, PhoneCall, UserCheck, Users } from 'lucide-react';
import { ETAPAS_CONFIRMACION, etapaDeConfirmacion } from './etapas';
import { decisorCorto, inversionCorta, inversionDe, tipoDe } from './propiedades';
import { TONO_SEGMENTO, TONO_TIPO, textoDe } from './Celda';

export const PREFIJO = { decision: 'Decide', inversion: 'Invierte', ingresos: 'Ingresos', examen: 'Examen', origen: 'Origen', telefono: 'Tel' };
const corto = (t, n = 26) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
const VERDE = 'var(--cl-success, #2FBF8F)', AMBAR = 'var(--cl-warning, #D9A441)', ROJO = 'var(--ui-danger, #f87171)';

// Una etiqueta por propiedad prendida, cada una con su color y su ícono.
export function chipsDe(a, claves, ctx) {
    const out = [];
    claves.forEach(k => {
        if (k === 'etapa') {
            const e = ETAPAS_CONFIRMACION.find(x => x.clave === etapaDeConfirmacion(a));
            out.push({ k, c: e.color, icono: <b className={`cv-punto${e.clave === 'por_contactar' ? ' cv-punto--late' : ''}`} />, t: e.titulo, fuerte: true });
        } else if (k === 'segmento') {
            if (a.segmento) out.push({ k, c: TONO_SEGMENTO[a.segmento], t: a.segmento, fuerte: true, title: `Segmento ${a.segmento}${a.segmento_puntos != null ? ` · ${a.segmento_puntos} pts` : ''}` });
        } else if (k === 'inversion') {
            const txt = inversionDe(a);
            if (txt) { const v = inversionCorta(txt); out.push({ k, c: v.sin ? ROJO : VERDE, icono: <DollarSign />, t: v.texto.replace(' USD', ''), title: txt }); }
        } else if (k === 'decision') {
            const d = decisorCorto(a);
            if (d) out.push({ k, c: d.solo === false ? AMBAR : d.solo ? VERDE : 'var(--cl-info, #4E8BD8)', icono: d.solo ? <UserCheck /> : <Users />, t: d.texto, title: d.title });
        } else if (k === 'tipo') {
            const t = tipoDe(a, ctx);
            out.push({ k, c: TONO_TIPO[t.clave], icono: <PhoneCall />, t: t.titulo });
        } else if (k === 'closer') {
            const n = textoDe(a, k, ctx);
            if (n) out.push({ k, c: 'var(--cl-lila, #7D8BFF)', icono: <i className="cv-ini">{n.trim()[0]}</i>, t: n.split(' ')[0], title: n });
        } else {
            const t = textoDe(a, k, ctx);
            if (t) out.push({ k, neutro: true, pre: PREFIJO[k], t: corto(t), title: t });
        }
    });
    return out;
}

export function Chips({ lista }) {
    return lista.map((x) => (
        <i key={x.k} className={`cv-chip${x.neutro ? ' cv-chip--neutro' : ''}${x.fuerte ? ' cv-chip--fuerte' : ''}`}
            style={{ '--c': x.c }} title={x.title}>
            {x.icono}{x.pre && <small>{x.pre}</small>}{x.t}
        </i>
    ));
}

