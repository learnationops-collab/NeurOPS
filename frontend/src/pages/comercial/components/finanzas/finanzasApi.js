import api from '../../../../services/api';

/**
 * Los endpoints de Finanzas y Payroll, que vivían en /admin/finance y /admin/payroll y desde el
 * 08/10/2026 son dos secciones del dock del dashboard comercial, al final. Son los mismos de siempre: lo que
 * cambió es dónde se ven. Responden a admin o dirección comercial con «ver finanzas»
 * (`finance_admin_required`), igual que `puede_ver_finanzas` del contexto, que es lo que muestra o esconde las secciones.
 */
const datos = (r) => r.data;

export const getResumen = (mes) => api.get('/public/finance/summary', { params: { month: mes } }).then(datos);
export const getAhorros = (mes) => api.get('/public/finance/savings', { params: { month: mes } }).then(datos);
export const guardarAhorros = (mes, savings) => api.post('/public/finance/savings', { month: mes, savings }).then(datos);

export const getSaldos = (mes) => api.get('/public/finance/balances', { params: { month: mes } }).then(datos);
export const guardarSaldo = (mes, metodo, campo, valor) => api.post('/public/finance/balances',
    { month: mes, payment_method: metodo, [campo]: valor }).then(datos);

export const getAnuncios = (mes) => api.get('/public/finance/ad-budget', { params: { month: mes } }).then(datos);
export const guardarAnuncios = (mes, budget) => api.post('/public/finance/ad-budget', { month: mes, budget }).then(datos);

// En orden: la nómina siembra a los integrantes variables que falten, y la lista de integrantes
// tiene que llegar con ellos (si no, salían como fijos y sin rol).
export const getNomina = async (mes) => {
    const nomina = await api.get('/public/finance/payroll', { params: { month: mes } }).then(datos);
    const integrantes = await api.get('/public/finance/team-members').then(datos);
    return { nomina, integrantes };
};
// Parcial (08/10/2026): {member_id, month, <solo el campo que cambió>}. Mandar `commissions` la
// deja manual; `{commissions_manual: false}` la vuelve al cálculo. Responde la fila como la del GET.
export const guardarNomina = (cambio) => api.post('/public/finance/payroll', cambio).then(datos);
export const crearIntegrante = (integrante) => api.post('/public/finance/team-members', integrante).then(datos);
export const editarIntegrante = (id, integrante) => api.put(`/public/finance/team-members/${id}`, integrante).then(datos);
export const eliminarIntegrante = (id) => api.delete(`/public/finance/team-members/${id}`).then(datos);

// Rutas propias de Finanzas: las de /admin/finance son solo de admin y operaciones, y la dirección
// comercial con «ver finanzas» quedaba afuera de esta vista.
export const getGastosSoftware = (mes) => api.get('/public/finance/software', { params: { month: mes } }).then(datos);
export const crearGasto = (gasto) => api.post('/public/finance/software', gasto).then(datos);
export const eliminarGasto = (id) => api.delete(`/public/finance/software/${id}`).then(datos);

export const getPayroll = (desde, hasta) => api.get('/public/financial-sales/payroll',
    { params: { start_date: desde, end_date: hasta } }).then(datos);
// Con el valor explícito y no «alternar»: dos clics rápidos no se cancelan entre sí.
export const marcarExclusion = (ventaId, excluir) => api.post(
    `/public/financial-sales/${ventaId}/toggle-payroll-exclusion`, { exclude: excluir }).then(datos);

// Los % de comisión (08/10/2026): los que valen en un mes, y guardar un juego desde un mes.
export const getTasas = (mes) => api.get('/public/finance/comisiones/tasas', { params: { mes } }).then(datos);
export const guardarTasas = (vigenteDesde, tasas) => api.put('/public/finance/comisiones/tasas',
    { vigente_desde: vigenteDesde, tasas }).then(datos);
