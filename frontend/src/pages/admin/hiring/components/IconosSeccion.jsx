import React from 'react';

// Íconos propios de las secciones de la ficha: duotono, con el trazo que se
// dibuja al abrir (`pathLength=1` deja animar el trazo con CSS, ver
// `.tl-fi-tile` en fichaPostulacion.css). Reciben `size` como los de lucide.

const Base = ({ size = 20, children }) => (
    <svg className="tl-fi-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
    </svg>
);

export const IcoExcluyentes = (p) => (
    <Base {...p}>
        <path className="relleno" pathLength="1" d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
        <path pathLength="1" d="m8.75 12.25 2.25 2.25 4.25-4.75" />
    </Base>
);

export const IcoDeseables = (p) => (
    <Base {...p}>
        <path className="relleno" pathLength="1" d="m12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
    </Base>
);

export const IcoIA = (p) => (
    <Base {...p}>
        <path className="relleno" pathLength="1" d="M10.5 4c.7 4.4 2.3 6 6.5 6.5-4.2.6-5.8 2.1-6.5 6.5-.7-4.4-2.3-5.9-6.5-6.5 4.2-.5 5.8-2.1 6.5-6.5Z" />
        <path pathLength="1" d="M18 14.5c.3 1.7.9 2.3 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.8 2.5-2.5Z" />
        <path pathLength="1" d="M18.5 3.5v3M17 5h3" />
    </Base>
);

export const IcoCualitativo = (p) => (
    <Base {...p}>
        <path className="relleno" pathLength="1" d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" />
        <path pathLength="1" d="M7.5 9h9M7.5 12.5h5.5" />
    </Base>
);
