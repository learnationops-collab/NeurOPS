// La bandeja de Conversaciones dentro del espacio del setter (1435, ADR-W184): la misma de /inbox, como una sección
// más de su dock, para que no salga a otro portal. Se carga aparte (lazy) para que los estilos del Inbox entren
// recién al abrirla. Los filtros y botones de la sección van a su propia barra (PageHeader sm).
import { dataThemeDe, useApariencia } from '../../context/AparienciaContext';
import { PageHeader, Toaster, Tooltip } from '../../components/standard';
import '../agendas_v2/thalamus.css';
import './inbox.css';
import Conversaciones from './Conversaciones';

export default function InboxEmbebido() {
    const apariencia = useApariencia();
    return (
        <div className="thalamus inbox inbox-embebido" data-theme={dataThemeDe(apariencia, undefined)}>
            <PageHeader size="sm" title="Conversaciones" />
            <Conversaciones />
            <Toaster />
            <Tooltip />
        </div>
    );
}
