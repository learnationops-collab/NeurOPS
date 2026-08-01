import React from 'react';
import Card from '../../../../components/ui/Card';

const Ring = ({ pct, label, note, color }) => {
    const r = 30, c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(100, pct) / 100);
    return (
        <div className="text-center bg-main/60 border border-base rounded-2xl px-3 py-4 hover:border-base-hover transition-all">
            <svg width="82" height="82" viewBox="0 0 82 82" className="mx-auto">
                <circle cx="41" cy="41" r={r} fill="none" stroke="var(--color-border)" strokeWidth="8" />
                <circle
                    cx="41" cy="41" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 41 41)"
                />
                <text x="41" y="47" textAnchor="middle" fill="currentColor" fontSize="18" fontWeight="900" className="text-base">{pct}%</text>
            </svg>
            <div className="text-[10.5px] font-black uppercase tracking-wider text-base mt-2 leading-tight">{label}</div>
            <div className="text-[10.5px] text-muted mt-0.5 leading-tight">{note}</div>
        </div>
    );
};

const PerformanceQuality = ({ rings }) => {
    const items = [
        { key: 'confirmation_rate', label: 'Confirmation rate', note: 'Agendas que se confirman', color: '#6366F1' },
        { key: 'show_rate', label: 'Show rate', note: 'Agendas que asisten', color: '#60A5FA' },
        { key: 'show_sobre_confirmada', label: 'Show s/ confirmada', note: 'Confirmadas que asisten', color: '#38BDF8' },
        { key: 'pitch_rate', label: 'Pitch rate', note: 'Asistencias con oferta', color: '#D946EF' },
        { key: 'close_llamada', label: 'Close s/ llamada', note: 'Asistencias que cierran', color: '#C026D3' },
        { key: 'close_presentacion', label: 'Close s/ presentación', note: 'Ofertas que cierran', color: '#FF3FA4' }
    ];

    return (
        <Card variant="surface" padding="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {items.map(it => (
                    <Ring key={it.key} pct={rings[it.key] ?? 0} label={it.label} note={it.note} color={it.color} />
                ))}
            </div>
        </Card>
    );
};

export default PerformanceQuality;
