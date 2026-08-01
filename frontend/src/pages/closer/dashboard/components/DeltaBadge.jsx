import React from 'react';
import { computeDelta } from '../performanceUtils';

const DeltaBadge = ({ current, previous, invert = false }) => {
    const delta = computeDelta(current, previous);
    if (delta === null) return null;
    if (delta.isNew) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-surface-hover text-muted">nuevo</span>;
    }
    const good = invert ? delta.pct < 0 : delta.pct > 0;
    const flat = delta.pct === 0;
    const colorClass = flat ? 'bg-surface-hover text-muted' : good ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400';
    const arrow = flat ? '—' : delta.pct > 0 ? '▲' : '▼';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${colorClass}`}>
            {arrow} {Math.abs(delta.pct)}%
        </span>
    );
};

export default DeltaBadge;
