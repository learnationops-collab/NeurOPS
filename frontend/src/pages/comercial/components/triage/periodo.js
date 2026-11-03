// El período del tablero de Triage: los mismos ids que el resto del dashboard comercial (`PERIODOS` de
// app/api/comercial.py) llevados a `desde`/`hasta` (AAAA-MM-DD) para `GET /api/triage/metricas`.

import { localDateFromNow, localToday } from '../../../../utils/datetime';

const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** `{ desde, hasta }` del período elegido; `custom` usa las fechas libres (`rango`, ya validadas arriba). */
export function rangoDePeriodo(periodo, rango = null) {
    const hoy = localToday();
    switch (periodo) {
    case 'hoy': return { desde: hoy, hasta: hoy };
    case 'ayer': return { desde: localDateFromNow(-1), hasta: localDateFromNow(-1) };
    case '7d': return { desde: localDateFromNow(-6), hasta: hoy };
    case '30d': return { desde: localDateFromNow(-29), hasta: hoy };
    case '90': return { desde: localDateFromNow(-89), hasta: hoy };
    case 'mes_pasado': {
        const [a, m] = hoy.split('-').map(Number);
        return { desde: aISO(new Date(a, m - 2, 1)), hasta: aISO(new Date(a, m - 1, 0)) };
    }
    case 'custom': return rango ? { desde: rango.desde, hasta: rango.hasta } : null;
    default: return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
    }
}
