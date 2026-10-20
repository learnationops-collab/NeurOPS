// Isotipo de Learnation (L blanca sobre degradé magenta), para las páginas públicas del lead.

import { useId } from 'react';

export default function Isotipo({ className }) {
    const id = useId();
    return (
        <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FF3FA4" /><stop offset="100%" stopColor="#FF6AD5" />
                </linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill={`url(#${id})`} />
            <g fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="5" strokeLinejoin="round">
                <path d="M49 18 L23 44 L23 83 L77 83 L77 61 L49 61 Z" /><path d="M23 18 L42 18 L23 37 Z" />
            </g>
        </svg>
    );
}
