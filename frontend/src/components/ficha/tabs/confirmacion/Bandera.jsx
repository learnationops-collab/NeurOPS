import React from 'react';
import { BANDERAS } from '../../../../pages/agendas_v2/ui/iconos';

/** La bandera del país (código ISO de dos letras), la misma de Thalamus. Nada si no la hay. */
const Bandera = ({ c, titulo }) => {
    if (!c || !BANDERAS[c]) return null;
    return (
        <span className="rp-bandera" title={titulo} aria-hidden={titulo ? undefined : true}>
            <svg viewBox="0 0 30 20" preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: BANDERAS[c] }} />
        </span>
    );
};

export default Bandera;
