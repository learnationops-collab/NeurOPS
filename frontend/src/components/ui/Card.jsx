import React from 'react';

const Card = ({ children, variant = 'surface', className = '', padding = 'p-8', glass = false, ...props }) => {
    const baseStyles = "rounded-main border border-base transition-all duration-300";

    const variants = {
        surface: "bg-surface shadow-xl",
        glass: "glass-effect",
        outline: "bg-transparent border-white/5"
    };

    return (
        <div
            className={`${baseStyles} ${variants[variant]} ${padding} ${glass ? 'glass-effect' : ''} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export const CardHeader = ({ children, className = '' }) => (
    <div className={`mb-6 ${className}`}>{children}</div>
);

export const CardContent = ({ children, className = '' }) => (
    <div className={className}>{children}</div>
);

export default Card;
