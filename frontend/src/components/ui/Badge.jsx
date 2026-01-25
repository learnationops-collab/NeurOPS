import React from 'react';

const Badge = ({ children, variant = 'neutral', className = '', ...props }) => {
    const variants = {
        neutral: "bg-slate-800 text-slate-400 border-slate-700",
        primary: "bg-primary/10 text-primary border-primary/20",
        secondary: "bg-secondary/10 text-secondary border-secondary/20",
        accent: "bg-accent/10 text-accent border-accent/20",
        success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-400 border-amber-500/20"
    };

    return (
        <span
            className={`
                inline-flex items-center px-3 py-1 rounded-full border 
                text-[9px] font-black uppercase tracking-widest
                ${variants[variant]} ${className}
            `}
            {...props}
        >
            {children}
        </span>
    );
};

export default Badge;
