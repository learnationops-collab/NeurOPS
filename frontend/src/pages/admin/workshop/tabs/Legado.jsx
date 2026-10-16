import React from 'react';

/**
 * El envoltorio del estilo viejo de Workshop (`.ws-shell`, ver workshop-intel.css). Cada pestaña que
 * todavía lo usa se envuelve sola: así sus reglas (`.ws-shell button {min-height:44px}`, el reset de
 * inputs…) no tocan lo que ya está en el estilo nuevo (`.dc-shell`). Al migrar una pestaña, se saca.
 */
const Legado = ({ children }) => (
    <div className="ws-shell ws-legado">
        <div className="dashboard">{children}</div>
    </div>
);

export default Legado;
