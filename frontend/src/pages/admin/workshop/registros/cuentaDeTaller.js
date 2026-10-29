import { dinero, numero } from '../talleres/formato';
import { parteDe, parteSuelta } from './cuentas';

/**
 * La lista (o la cuenta «N de M») detrás de cada cifra de UN taller, para la tabla y las tarjetas de Talleres
 * (Kerwin, 28/10/2026). Devuelve `{ metrica }` si la cifra es un número que abre su lista, `{ cuenta }` si es una
 * razón (costo, tasa, ROAS), o null si no tiene lista (los datos de tráfico de Meta, la ganancia).
 *
 * `onVer(lista, titulo, [taller])` es el `abrir` de `useRegistrosWorkshop` con el taller de la fila.
 */
export const cuentaDeTaller = (clave, e) => {
    const inv = parteDe(dinero(e.inversion), 't_inversion');
    const de = (n, lista, unidad) => parteDe(`${numero(n)}${unidad ? ` ${unidad}` : ''}`, lista);
    switch (clave) {
        case 'inversion': return { metrica: 't_inversion' };
        case 'leads': return { metrica: 't_leads' };
        case 'whatsapp': return { metrica: 't_whatsapp_leads' };
        case 'aplicaciones': return { metrica: 't_aplicaciones_form' };
        case 'asistieron': return { metrica: 'show_up' };
        case 'ventas': return { metrica: 'ventas' };
        case 'cash': return { metrica: 'cash_total' };
        case 'agendas': return { metrica: 'agendas' };
        case 'cpl': return { cuenta: { a: inv, b: de(e.leads, 't_leads', 'leads') } };
        case 'costo_agenda': return { cuenta: { a: inv, b: de(e.agendas_exitosas, 'agendas', 'agendas') } };
        case 'cac': return { cuenta: { a: inv, b: de(e.sales, 'ventas', 'ventas') } };
        case 'show_up': return { cuenta: { a: de(e.show_up, 't_show_up'), b: de(e.whatsapp_leads, 't_whatsapp_leads', 'en WhatsApp') } };
        case 'close_rate': return { cuenta: { a: de(e.sales, 'ventas'), b: de(e.show_up_sales_call, 'show_up', 'que asistieron') } };
        case 'roas': return { cuenta: { a: parteDe(dinero(e.cash_collected), 'cash_total'), b: inv } };
        case 'ticket': {
            if (!e.ventas_cobradas) return null;
            return { cuenta: { a: parteDe(dinero(e.cash_ventas), 'new_cash'), b: parteSuelta(`${numero(e.ventas_cobradas)} ${e.ventas_cobradas === 1 ? 'venta' : 'ventas'}`) } };
        }
        default: return null;
    }
};

/** Cada paso del embudo de una tarjeta (`pasosEmbudo`) → la lista que lo suma. */
export const LISTA_DE_PASO = {
    leads: 't_leads', whatsapp: 't_whatsapp_leads', show_up: 't_show_up', pitch: 't_pitch_leads', pitch_final: 't_pitch_final_leads',
    aplicaciones: 't_aplicaciones_form', agendas: 'agendas', asistieron: 'show_up', ventas: 'ventas',
};
