import React from 'react';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    loading = false,
    icon: Icon,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-btn";

    const variants = {
        primary: "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20",
        secondary: "bg-secondary text-white hover:bg-secondary-hover shadow-lg shadow-secondary/20",
        outline: "bg-transparent border border-base hover:border-white text-muted hover:text-white",
        ghost: "bg-transparent hover:bg-white/5 text-muted hover:text-white",
        glass: "glass-effect text-white hover:bg-white/10"
    };

    const sizes = {
        xs: "px-3 py-1.5 text-[8px]",
        sm: "px-4 py-2 text-[9px]",
        md: "px-6 py-3.5 text-[10px]",
        lg: "px-8 py-5 text-xs",
        xl: "px-10 py-6 text-sm"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
                <>
                    {Icon && <Icon size={16} className={children ? 'mr-2' : ''} />}
                    {children}
                </>
            )}
        </button>
    );
};

export default Button;
