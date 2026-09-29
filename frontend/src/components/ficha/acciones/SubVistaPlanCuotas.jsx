// Sub-vista «Armar plan de cuotas»: el marco con «Volver», alrededor del editor compartido.
//
// El editor en sí vive en `PlanCuotasForm`, porque el mismo se monta en línea en la sección «Plan
// de cuotas» del historial. Acá sólo queda el marco.

import { SubVista } from './piezas';
import PlanCuotasForm from './PlanCuotasForm';

export default function SubVistaPlanCuotas({ ficha, onVolver, onGuardar, guardando }) {
  return (
    <SubVista titulo="Armar plan de cuotas" onVolver={onVolver}>
      <PlanCuotasForm ficha={ficha} onGuardar={onGuardar} guardando={guardando}>
        {({ boton }) => (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{boton}</div>
        )}
      </PlanCuotasForm>
    </SubVista>
  );
}
