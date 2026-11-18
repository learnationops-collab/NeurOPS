// El panel de la derecha del chat: la ficha del lead o Learnito, en pestañas. Learnito va acá y no en un modal
// para que el setter lea lo que le dice mientras le escribe al lead. Es la misma conversación de Learnito que el
// resto de Work (LearnitoContext).
import { Sparkles } from 'lucide-react';
import { Panel, Segmented } from '../../../components/standard';
import LearnitoChat from '../../copiloto/LearnitoChat';
import { useLearnito } from '../../../sesion/LearnitoContext';
import FichaLead from './FichaLead';

const PESTANAS = [
    { value: 'ficha', label: 'Ficha' },
    { value: 'learnito', label: 'Learnito', icon: <Sparkles size={13} /> },
];

export default function PanelDerecho({ panel, onPanel, ...ficha }) {
    const learnito = useLearnito();
    if (!learnito) return <FichaLead {...ficha} />;
    return (
        <div className="cv-derecha">
            <Segmented size="sm" label="Panel" value={panel} onChange={onPanel} options={PESTANAS} />
            {panel === 'learnito'
                ? <Panel as="aside" size="sm" className="cv-learnito" aria-label="Learnito"><LearnitoChat /></Panel>
                : <FichaLead {...ficha} />}
        </div>
    );
}
