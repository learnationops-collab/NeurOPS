import { STAGE_ORDER } from '../funnelMath';

/**
 * Las cuentas detrás de las cifras del Resumen de Workshop (Kerwin, 28/10/2026): cada cifra dice «N de M» y cada
 * parte abre su lista. Dos clases de lista:
 *
 *  · de personas o cobros (`agendas`, `show_up`, `reportadas`, `ventas`, `new_cash`, `cash_total`): salen del
 *    backend con el mismo código que la cifra del taller (`workshop_registros_service`);
 *  · de talleres (`t_…`): lo que cargó o sincronizó cada taller (inversión, leads de Meta, WhatsApp, asistencia
 *    a la clase, pitch, formulario). No hay personas detrás, así que la lista es taller por taller.
 */
export const TITULOS = {
    agendas: 'Agendas', show_up: 'Asistieron a su cita', reportadas: 'Citas con resultado', ventas: 'Ventas',
    new_cash: 'New Cash', cash_total: 'Cash total',
    t_inversion: 'Inversión', t_leads: 'Leads', t_whatsapp_leads: 'Pasaron a WhatsApp', t_show_up: 'Asistieron al taller',
    t_pitch_leads: 'Llegaron al pitch', t_pitch_final_leads: 'Vieron el pitch completo', t_aplicaciones_form: 'Aplicaron al formulario',
};

/** Las listas por taller: el campo del taller que suman y de dónde viene el valor, si se sabe. */
export const POR_TALLER = {
    t_inversion: { campo: 'inversion', dinero: true, origen: (e) => (e.meta_inversion != null ? 'Meta' : 'A mano') },
    t_leads: { campo: 'leads', origen: (e) => (e.meta_leads != null ? 'Meta' : 'A mano') },
    t_whatsapp_leads: { campo: 'whatsapp_leads' },
    t_show_up: { campo: 'show_up' },
    t_pitch_leads: { campo: 'pitch_leads' },
    t_pitch_final_leads: { campo: 'pitch_final_leads' },
    t_aplicaciones_form: { campo: 'aplicaciones_form' },
};

// Campo del taller → la lista que lo suma.
const LISTA_DE = {
    inversion: 't_inversion', leads: 't_leads', whatsapp_leads: 't_whatsapp_leads', show_up: 't_show_up', pitch_leads: 't_pitch_leads',
    pitch_final_leads: 't_pitch_final_leads', aplicaciones_form: 't_aplicaciones_form', agendas_exitosas: 'agendas',
    show_up_sales_call: 'show_up', citas_reportadas: 'reportadas', sales: 'ventas',
};
const UNIDAD = {
    leads: 'leads', whatsapp_leads: 'en WhatsApp', show_up: 'que asistieron', pitch_leads: 'en el pitch', pitch_final_leads: 'al final del pitch',
    aplicaciones_form: 'formularios', agendas_exitosas: 'agendas', show_up_sales_call: 'que asistieron', citas_reportadas: 'con resultado',
};
const entero = (v) => Math.round(Number(v) || 0).toLocaleString('en-US');

const parte = (campo, valor, conUnidad) => ({
    t: conUnidad && UNIDAD[campo] ? `${entero(valor)} ${UNIDAD[campo]}` : entero(valor),
    m: LISTA_DE[campo], titulo: TITULOS[LISTA_DE[campo]],
});

/** `{ a, b }` de una etapa de la salud del embudo, a partir de los totales de los talleres (`aggregateTotals`). */
export const cuentaDeEtapa = (clave, totales) => {
    const etapa = STAGE_ORDER.find((s) => s.key === clave);
    if (!etapa || !totales) return null;
    return { a: parte(etapa.num, totales[etapa.num]), b: parte(etapa.den, totales[etapa.den], true) };
};

/** Una parte en dinero o en cantidad, con la lista que la suma. */
export const parteDe = (texto, lista) => ({ t: texto, m: lista, titulo: TITULOS[lista] });
/** Una parte que no tiene lista propia (se ve en el tooltip, no se toca). */
export const parteSuelta = (texto) => ({ t: texto, m: null });
