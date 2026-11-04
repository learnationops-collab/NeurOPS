import React from 'react';
import './alDia.css';

// El aviso de «no queda nadie por revisar»: el anillo se dibuja, entra el check y
// queda un halo que respira, con unas chispas alrededor. Reemplaza a la tarjeta
// «Al día» y al ícono fijo, que repetían lo mismo.
const AlDia = () => (
    <span className="tl-aldia" aria-hidden="true">
        <span className="tl-aldia-halo" />
        <svg viewBox="0 0 64 64" width="64" height="64">
            <defs>
                <linearGradient id="tlAldiaG" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2FBF8F" />
                    <stop offset="1" stopColor="#4E8BD8" />
                </linearGradient>
            </defs>
            <circle className="tl-aldia-fondo" cx="32" cy="32" r="26" />
            <circle className="tl-aldia-anillo" cx="32" cy="32" r="26" pathLength="1" />
            <path className="tl-aldia-check" d="M21 33.5l7.5 7.5L43.5 25" pathLength="1" />
        </svg>
        {[0, 1, 2, 3].map((i) => <i key={i} className="tl-aldia-chispa" style={{ '--i': i }} />)}
    </span>
);

export default AlDia;
