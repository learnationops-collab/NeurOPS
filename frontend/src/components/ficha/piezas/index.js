// Punto único de entrada a las piezas compartidas de la ficha: las pestañas
// importan de acá y no de la ruta de cada archivo, así mover una pieza no toca
// a sus consumidores.
export { default as Aviso } from './Aviso';
export { default as DesplegableAgrupado } from './DesplegableAgrupado';
export { default as SeccionColapsable } from './SeccionColapsable';
export { default as SelectorFecha, construirMes } from './SelectorFecha';
export { default as StepperFicha } from './StepperFicha';
export { default as SubVista } from './SubVista';
export { default as usarMovimiento } from './movimiento';
export { default as TarjetaAccion } from './TarjetaAccion';
export { default as usarPopover } from './usarPopover';
