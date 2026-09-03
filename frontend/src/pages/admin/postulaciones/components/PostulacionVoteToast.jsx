import React, { useEffect, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';

const VOTO_TOAST = {
    pre: { label: 'Preseleccionado', color: '#34d399', bg: 'rgba(52,211,153,.15)', Icon: Check },
    res: { label: 'En reserva', color: '#fbbf24', bg: 'rgba(251,191,36,.15)', Icon: Clock },
    des: { label: 'Descartado', color: '#f87171', bg: 'rgba(248,113,113,.15)', Icon: X },
};

const PostulacionVoteToast = ({ toast, onDone }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!toast) return;
        setVisible(true);
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(onDone, 200);
        }, 1650);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast]);

    if (!toast) return null;

    const { label, color, bg, Icon } = VOTO_TOAST[toast.valor] || VOTO_TOAST.des;

    return (
        <div
            className="fixed left-1/2 top-1/2 z-[110] w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/15 bg-[#141a3a] shadow-2xl transition-all duration-200"
            style={{ opacity: visible ? 1 : 0, transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.92})` }}
        >
            <div className="flex items-center gap-5 px-8 py-6">
                <span
                    className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl"
                    style={{ background: bg, color }}
                >
                    <Icon size={26} strokeWidth={3} />
                </span>
                <div className="min-w-0 flex flex-col gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>
                        {label}
                    </span>
                    <span className="truncate text-lg font-bold tracking-tight text-white">{toast.nombre}</span>
                    <span className="text-[13px] text-white/60">{toast.mensajeFin}</span>
                </div>
            </div>
            <div className="h-1 bg-white/10">
                <div
                    className="h-full origin-left"
                    style={{ background: color, animation: visible ? 'ln-toast-bar 1.65s linear both' : 'none' }}
                />
            </div>
            <style>{`@keyframes ln-toast-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
        </div>
    );
};

export default PostulacionVoteToast;
