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
            <path d="M31.35 28.91H42.58Q43.75 28.91 43.75 30.08C43.75 50.59 57.23 54.98 68.65 54.98Q69.82 54.98 69.82 56.15V69.83Q69.82 71 68.65 71H31.35Q30.18 71 30.18 69.83V30.08Q30.18 28.91 31.35 28.91Z" fill="#FFFFFF" />
        </svg>
    );
}
