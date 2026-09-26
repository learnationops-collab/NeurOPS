// Punto único de entrada a las piezas compartidas de la ficha: las pestañas
// importan de acá y no de la ruta de cada archivo, así mover una pieza no toca
// a sus consumidores.
export { default as Aviso } from './Aviso';
export { default as DesplegableAgrupado } from './DesplegableAgrupado';
export { default as fechaLegible, soloDia } from './fecha';
export { default as SeccionColapsable } from './SeccionColapsable';
export { default as SelectorFecha, construirMes } from './SelectorFecha';
export { default as StepperFicha } from './StepperFicha';
export { default as SubVista } from './SubVista';
export { default as useMovimiento } from './useMovimiento';
export { default as TarjetaAccion } from './TarjetaAccion';
export { default as usePopover } from './usePopover';
