import api from '../../../../../services/api';

/**
 * Los endpoints de la tabla vieja de Ventas de Operaciones (`app/api/public/financial_sales.py`) que
 * las acciones de Revisar siguen usando (10/10/2026). Son los mismos: la tabla se fue, lo que hacía
 * no. El `id` de una fila de Ventas de Revisar es el de la `FinancialSale`.
 */

/**
 * Una venta tal como la manda la tabla vieja (`to_dict` más el closer resuelto, el programa…): es la
 * forma que espera `AttributionModal`. `ids` sin `page` devuelve una lista.
 */
export const getVenta = (id) => api.get('/public/financial-sales', { params: { ids: String(id) } })
    .then(r => (Array.isArray(r.data) ? r.data.find(v => v.id === id) || r.data[0] : null) || null);

/** Vuelve a mandar la venta al webhook de n8n. */
export const reenviarWebhook = (id) => api.post(`/public/financial-sales/${id}/resend-webhook`)
    .then(r => r.data);

/**
 * Las opciones de closer y setter del «Editar en lote», de donde las sacaba la tabla vieja: los
 * closers del período más los del sistema (`unique_closers`) y las fuentes que existen en el período
 * (`unique_setters`). Se pide una página de una fila: lo que interesa son las listas, no las ventas.
 */
export const getOpcionesDeLote = (fechas) => api.get('/public/financial-sales', {
    params: { page: 1, limit: 1, start_date: fechas?.start || '', end_date: fechas?.end || '' },
}).then(r => ({
    closers: (r.data?.unique_closers || []).filter(c => c && c !== 'Sin Closer'),
    setters: (r.data?.unique_setters || []).filter(s => s && s !== 'Sin Setter'),
}));

/**
 * Aplica los mismos cambios a varias ventas. `cambios` lleva solo los campos que cambian (los que
 * faltan el backend no los toca): `programa`, `tipo_pago_simple`, `metodo_pago`, `estado`,
 * `email_vendedor` y `setter`.
 */
export const editarEnLote = (ids, cambios) => api.post('/public/financial-sales/bulk-update', {
    sale_ids: ids, ...cambios,
}).then(r => r.data);
