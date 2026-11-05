// Integraciones del espacio de Operaciones: las conexiones de Work con cuentas externas que no son de
// una persona (hoy, los Drives de donde salen las notas de Meet, y las categorías de esas notas). Usa las tarjetas de la Configuración
// (agendas_v2/secciones/conf), que viven bajo `.thalamus`.

import TarjetaCategoriasMeet from '../agendas_v2/secciones/conf/TarjetaCategoriasMeet';
import TarjetaNotasMeet from '../agendas_v2/secciones/conf/TarjetaNotasMeet';
import { useTemaDeHoja } from '../../sesion/temaDeHoja';
import '../agendas_v2/thalamus.css';

export default function PanelIntegraciones() {
    const [raiz, dataTheme] = useTemaDeHoja();
    return (
        <div ref={raiz} className="thalamus cu-hoja operador-panel" data-theme={dataTheme}>
            <div className="cu-cuerpo">
                <TarjetaNotasMeet />
                <TarjetaCategoriasMeet />
            </div>
        </div>
    );
}
