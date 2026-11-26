// La bandeja de Conversaciones dentro del espacio del setter (1435, ADR-W184): la misma de /inbox, como una sección
// más de su dock, para que no salga a otro portal. Se carga aparte (lazy) para que los estilos del Inbox entren
// recién al abrirla. Sin cabecera propia: los filtros y botones de la sección suben a la fila del saludo del setter
// (`#ui-header-actions` en SetterEspacioPage, 26/11/2026); el nombre de la sección lo dice el dock.
import { dataThemeDe, useApariencia } from '../../context/AparienciaContext';
import { Toaster, Tooltip } from '../../components/standard';
import '../agendas_v2/thalamus.css';
import './inbox.css';
import Conversaciones from './Conversaciones';
import Embudos from './embudos/Embudos';

// `seccion`: 'conversaciones' (la bandeja) o 'guia' (Embudos: la Guía de cada fase y sus seguimientos, ADR-W204).
export default function InboxEmbebido({ seccion = 'conversaciones' }) {
    const apariencia = useApariencia();
    return (
        <div className="thalamus inbox inbox-embebido" data-theme={dataThemeDe(apariencia, undefined)}>
            {seccion === 'guia' ? <Embudos /> : <Conversaciones />}
            <Toaster />
            <Tooltip />
        </div>
    );
}
