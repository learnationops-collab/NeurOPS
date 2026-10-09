import api from '../../../../services/api';

/**
 * Los endpoints de Finanzas y Payroll, que vivían en /admin/finance y /admin/payroll y desde el
 * 08/10/2026 son dos secciones del dock del dashboard comercial, al final. Son los mismos de siempre: lo que
 * cambió es dónde se ven. Responden a admin o dirección comercial con «ver finanzas»
 * (`finance_admin_required`), igual que `puede_ver_finanzas` del contexto, que es lo que muestra o esconde las secciones.
 */
const datos = (r) => r.data;

// El período de Finanzas (08/10/2026): justo un mes va como `month`, igual que siempre; un rango
// personalizado, con sus dos fechas. Lo que se guarda (ahorros, saldos, anuncios) es siempre de un mes.
const delPeriodo = (periodo) => (periodo.mes ? { month: periodo.mes }
    : { start_date: periodo.desde, end_date: periodo.hasta });

export const getResumen = (periodo) => api.get('/public/finance/summary', { params: delPeriodo(periodo) }).then(datos);
export const getAhorros = (periodo) => api.get('/public/finance/savings', { params: delPeriodo(periodo) }).then(datos);
export const guardarAhorros = (mes, savings) => api.post('/public/finance/savings', { month: mes, savings }).then(datos);

export const getSaldos = (periodo) => api.get('/public/finance/balances', { params: delPeriodo(periodo) }).then(datos);
export const guardarSaldo = (mes, metodo, campo, valor) => api.post('/public/finance/balances',
    { month: mes, payment_method: metodo, [campo]: valor }).then(datos);

export const getAnuncios = (periodo) => api.get('/public/finance/ad-budget', { params: delPeriodo(periodo) }).then(datos);
export const guardarAnuncios = (mes, budget) => api.post('/public/finance/ad-budget', { month: mes, budget }).then(datos);

const nominaDelMes = (mes) => api.get('/public/finance/payroll', { params: { month: mes } }).then(datos);

// En orden: la nómina siembra a los integrantes variables que falten, y la lista de integrantes
// tiene que llegar con ellos (si no, salían como fijos y sin rol).
export const getNomina = async (mes) => {
    const nomina = await nominaDelMes(mes);
    const integrantes = await api.get('/public/finance/team-members').then(datos);
    return { nomina, integrantes };
};

// La nómina de varios meses (un período personalizado), una lista por mes en el mismo orden. El
// primero va solo, porque siembra a los variables que falten; el resto, en paralelo.
export const getNominas = async (meses) => {
    const [primero, ...resto] = meses;
    const nominas = [await nominaDelMes(primero), ...await Promise.all(resto.map(nominaDelMes))];
    const integrantes = await api.get('/public/finance/team-members').then(datos);
    return { nominas, integrantes };
};
// Parcial (08/10/2026): {member_id, month, <solo el campo que cambió>}. Mandar `commissions` la
// deja manual; `{commissions_manual: false}` la vuelve al cálculo. Responde la fila como la del GET.
export const guardarNomina = (cambio) => api.post('/public/finance/payroll', cambio).then(datos);
export const crearIntegrante = (integrante) => api.post('/public/finance/team-members', integrante).then(datos);
export const editarIntegrante = (id, integrante) => api.put(`/public/finance/team-members/${id}`, integrante).then(datos);
export const eliminarIntegrante = (id) => api.delete(`/public/finance/team-members/${id}`).then(datos);

// Rutas propias de Finanzas: las de /admin/finance son solo de admin y operaciones, y la dirección
// comercial con «ver finanzas» quedaba afuera de esta vista.
export const getGastosSoftware = (periodo) => api.get('/public/finance/software', { params: delPeriodo(periodo) }).then(datos);
export const crearGasto = (gasto) => api.post('/public/finance/software', gasto).then(datos);
export const eliminarGasto = (id) => api.delete(`/public/finance/software/${id}`).then(datos);

export const getPayroll = (desde, hasta) => api.get('/public/financial-sales/payroll',
    { params: { start_date: desde, end_date: hasta } }).then(datos);
// Con el valor explícito y no «alternar»: dos clics rápidos no se cancelan entre sí.
export const marcarExclusion = (ventaId, excluir) => api.post(
    `/public/financial-sales/${ventaId}/toggle-payroll-exclusion`, { exclude: excluir }).then(datos);

// La atribución de una venta desde Payroll (08/10/2026): a quiénes se puede elegir ({setters,
// closers}, cada una {id, nombre, activo}) y el cambio, {setter_id?, closer_id?, desde, hasta}. El
// período es el de Payroll: con él el backend corrige la agenda que mira la nómina de esas fechas.
export const getPersonasAtribuibles = () => api.get('/public/finance/atribucion/personas').then(datos);
export const cambiarAtribucion = (ventaId, cambio) => api.put(
    `/public/finance/ventas/${ventaId}/atribucion`, cambio).then(datos);

// Los % de comisión (08/10/2026): los que valen en un mes, y guardar un juego desde un mes.
export const getTasas = (mes) => api.get('/public/finance/comisiones/tasas', { params: { mes } }).then(datos);
export const guardarTasas = (vigenteDesde, tasas) => api.put('/public/finance/comisiones/tasas',
    { vigente_desde: vigenteDesde, tasas }).then(datos);

// De dónde entró el ingreso del Resumen (08/10/2026): por fechas y no por mes, así sirve igual
// cuando Finanzas se mire por un período cualquiera.
export const getProcedencia = (desde, hasta) => api.get('/public/finance/procedencia',
    { params: { start_date: desde, end_date: hasta } }).then(datos);

// Diferencias (09/10/2026): los CSV de Stripe y Hotmart contra lo reportado. La conciliación del
// período, subir un CSV (con la pasarela si hubo que elegirla), borrar una carga, corregir una venta
// reportada ({monto?, fecha?, metodo_pago?, transferido_a?}) y marcar una diferencia como revisada.
export const getConciliacion = (periodo) => api.get('/public/finance/conciliacion',
    { params: delPeriodo(periodo) }).then(datos);
export const subirCsv = (archivo, pasarela = null) => {
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    if (pasarela) formulario.append('pasarela', pasarela);
    return api.post('/public/finance/conciliacion/cargas', formulario).then(datos);
};
export const borrarCarga = (id) => api.delete(`/public/finance/conciliacion/cargas/${id}`).then(datos);
export const corregirVenta = (id, cambios) => api.put(`/public/finance/conciliacion/ventas/${id}`, cambios).then(datos);
export const marcarRevisada = (clave, revisada, extra = {}) => api.post('/public/finance/conciliacion/revisiones',
    { clave, revisada, ...extra }).then(datos);
