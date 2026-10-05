// Dónde viven los datos de Thalamus: en la API (/api/agendas-v2) por defecto, o en este navegador
// (adaptadorLocal) en los tests de vitest y con VITE_AGENDAS_LOCAL=1 (para probar sin backend).
export const MODO_LOCAL = import.meta.env.MODE === 'test' || import.meta.env.VITE_AGENDAS_LOCAL === '1';
