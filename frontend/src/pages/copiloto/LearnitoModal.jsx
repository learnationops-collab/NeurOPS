// Learnito en un modal, encima de cualquier pantalla (se abre desde el dock o el menú de sesión).
// Va envuelto en `.thalamus` para tener los tokens del tema fuera de las pantallas que ya lo traen.
import { RotateCcw, Sparkles } from 'lucide-react';
import '../agendas_v2/thalamus.css';
import { dataThemeDe, useApariencia } from '../../context/AparienciaContext';
import { IconButton, Modal, ModalHeader } from '../../components/standard';
import { useLearnito } from '../../sesion/LearnitoContext';
import LearnitoChat from './LearnitoChat';

export default function LearnitoModal({ onClose }) {
    const apariencia = useApariencia();
    const { mensajes, enviando, reiniciar } = useLearnito();

    return (
        <div className="thalamus learnito-capa" data-theme={dataThemeDe(apariencia, undefined)}>
            <Modal onClose={onClose} className="learnito-modal" labelledBy="learnito-titulo">
                <ModalHeader icon={<Sparkles size={20} className="cp-logo" aria-hidden="true" />}
                    title="Learnito" subtitle="Tu copiloto" titleId="learnito-titulo" onClose={onClose}
                    actions={mensajes.length > 0 && (
                        <IconButton size="sm" icon={<RotateCcw size={14} />} label="Nueva conversación"
                            title="Nueva conversación" onClick={reiniciar} disabled={enviando} />
                    )} />
                <LearnitoChat />
            </Modal>
        </div>
    );
}
