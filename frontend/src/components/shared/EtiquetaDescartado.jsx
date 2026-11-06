import React from 'react';
import { UserX } from 'lucide-react';
import { Chip } from '../standard';

export const AYUDA_DESCARTADO = 'No respondió ningún mensaje; el closer lo descartó.';

/** Al lado del chip «No show» de una agenda que el closer descartó (ADR-W110). El estado sigue siendo No show. */
const EtiquetaDescartado = ({ visible }) => (visible ? (
    <Chip subtle color="#F97316" icon={<UserX aria-hidden="true" />} title={AYUDA_DESCARTADO}
        style={{ marginLeft: 6, height: 22, padding: '0 8px', fontSize: 11 }}>
        Descartado
    </Chip>
) : null);

export default EtiquetaDescartado;
