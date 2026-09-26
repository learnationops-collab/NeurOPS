// Único punto de contacto con las piezas compartidas de `ficha/piezas/`, que las escribe el
// agente del modal. Todo lo de `tabs/TabResultado`, `tabs/TabAcciones` y `acciones/` importa
// desde acá y nunca desde `../piezas/…` directo: si al integrar la ruta o la forma del export
// no coincide, se arregla en este archivo y no en ocho.
//
// Contrato acordado (§10 de la especificación):
//   <StepperFicha pasos={[{key,label,sub,estado}]} onPaso={fn|null} />
//   <DesplegableAgrupado grupos={[{titulo,tono,opciones}]} valor multiple onChange onAgregar />
//   <SelectorFecha valor onChange presets minimo />
//   <TarjetaAccion tono icono label onClick />
//   <SeccionColapsable titulo resumen>…</SeccionColapsable>
//   <SubVista titulo onVolver acciones>…</SubVista>

export { default as StepperFicha } from '../piezas/StepperFicha';
export { default as DesplegableAgrupado } from '../piezas/DesplegableAgrupado';
export { default as SelectorFecha } from '../piezas/SelectorFecha';
export { default as TarjetaAccion } from '../piezas/TarjetaAccion';
export { default as SeccionColapsable } from '../piezas/SeccionColapsable';
export { default as SubVista } from '../piezas/SubVista';
