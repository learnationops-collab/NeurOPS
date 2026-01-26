import React from 'react';

const Input = ({ label, error, icon: Icon, className = '', ...props }) => {
    return (
        <div className={`space-y-2 w-full ${className}`}>
            {label && (
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 block">
                    {label}
                </label>
            )}
            <div className="relative group">
                {Icon && (
                    <Icon
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-primary transition-colors"
                    />
                )}
                <input
                    className={`
                        w-full bg-black/40 border border-base rounded-2xl py-4 
                        ${Icon ? 'pl-12' : 'px-6'} pr-6 
                        text-white text-sm outline-none focus:ring-2 focus:ring-primary/50 
                        transition-all font-bold placeholder-slate-600
                    `}
                    {...props}
                />
            </div>
            {error && <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1">{error}</p>}
        </div>
    );
};

export default Input;
