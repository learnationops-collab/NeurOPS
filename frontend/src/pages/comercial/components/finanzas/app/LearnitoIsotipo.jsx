import React, { useId } from 'react';

/**
 * El isotipo de Learnito, animado (handoff «Nodos que convergen»): tres nodos viajan al centro y ahí
 * nace el destello, en un loop de 4 s, con el aura que respira. Sirve de `Icono` (recibe `size`) en el
 * menú de sesión y en los accesos fijados del dock. Los estilos están en finanzasApp.css (`.ln-iso`).
 */
const LearnitoIsotipo = ({ size = 20 }) => {
    const id = useId().replace(/:/g, '');
    return (
        <svg className="ln-iso" width={size} height={size} viewBox="0 0 100 100" overflow="visible" aria-hidden="true">
            <defs>
                <linearGradient id={`m${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
                    <stop offset="0" stopColor="#FF3FA4" /><stop offset="1" stopColor="#FF6AD5" />
                </linearGradient>
                <radialGradient id={`a${id}`}>
                    <stop offset="0" stopColor="#FF3FA4" stopOpacity=".75" />
                    <stop offset=".45" stopColor="#FF6AD5" stopOpacity=".28" />
                    <stop offset="1" stopColor="#FF6AD5" stopOpacity="0" />
                </radialGradient>
            </defs>
            <circle className="ln-aura" cx="50" cy="52" r="74" fill={`url(#a${id})`} />
            <rect width="100" height="100" rx="26" fill={`url(#m${id})`} />
            <g transform="translate(15 15) scale(.7)" fill="none" stroke="#fff" strokeLinejoin="round" strokeLinecap="round">
                <path className="ln-spark" d="M50 26 Q54.3 45.7 74 50 Q54.3 54.3 50 74 Q45.7 54.3 26 50 Q45.7 45.7 50 26 Z" strokeWidth="5.5" />
                <circle className="ln-n" cx="14" cy="18" r="6.5" strokeWidth="4.5" style={{ '--dx': '36px', '--dy': '32px' }} />
                <circle className="ln-n" cx="88" cy="26" r="6.5" strokeWidth="4.5" style={{ '--dx': '-38px', '--dy': '24px', animationDelay: '.08s' }} />
                <circle className="ln-n" cx="30" cy="88" r="6.5" strokeWidth="4.5" style={{ '--dx': '20px', '--dy': '-38px', animationDelay: '.16s' }} />
            </g>
        </svg>
    );
};

export default LearnitoIsotipo;
