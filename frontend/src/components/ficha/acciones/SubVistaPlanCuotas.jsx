// Sub-vista «Armar plan de cuotas»: el marco con «Volver», alrededor del editor compartido.
//
// El editor en sí vive en `PlanCuotasForm`, porque el mismo se monta en línea en la sección «Plan
// de cuotas» del historial. Acá sólo queda el marco.
//
// El guardado va en el pie del marco, a la derecha de «Volver», igual que en las demás
// sub-vistas (ver `SubReprogramar`): una sola barra de botones, y la que ya le deja su hueco al
// widget de reporte de bugs que flota abajo a la derecha.

import { SubVista } from './piezas';
import PlanCuotasForm from './PlanCuotasForm';

export default function SubVistaPlanCuotas({ ficha, onVolver, onGuardar, guardando }) {
  return (
    <PlanCuotasForm ficha={ficha} onGuardar={onGuardar} guardando={guardando}>
      {({ formulario, boton }) => (
        <SubVista titulo="Armar plan de cuotas" onVolver={onVolver} acciones={boton}>
          {formulario}
        </SubVista>
      )}
    </PlanCuotasForm>
  );
}
