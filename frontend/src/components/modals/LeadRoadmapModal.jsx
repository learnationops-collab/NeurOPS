import React from 'react';
import LeadRoadmapDetail from '../leads/LeadRoadmapDetail';
import Modal from '../ui/Modal';

// Roadmap del lead en un modal ancho. Va sobre el cascarón `Modal`: portal a body (montado en las
// páginas quedaba en el `space-y-*` y en el `z-10` del layout), alto máximo de la ventana y la X en
// una cabecera fija. Antes la X flotaba encima del contenido y podía taparle la cabecera al detalle.
const LeadRoadmapModal = ({ isOpen, instagram, clientId, email, phone, fullName, onClose, onSuccess }) => {
    if (!isOpen) return null;

    return (
        <Modal
            ancho="roadmap"
            titulo="Roadmap del lead"
            onCerrar={onClose}
        >
            <LeadRoadmapDetail
                instagram={instagram}
                clientId={clientId}
                email={email}
                phone={phone}
                name={fullName}
                onBack={onClose}
                onUpdate={onSuccess}
            />
        </Modal>
    );
};

export default LeadRoadmapModal;
