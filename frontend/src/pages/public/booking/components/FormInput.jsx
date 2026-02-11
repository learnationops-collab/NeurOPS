import React from 'react';

const FormInput = ({ label, icon, placeholder, value, onChange, type = "text" }) => (
    <div className="space-y-3">
        <label className="text-[10px] font-bold text-muted tracking-widest ml-1">{label}</label>
        <div className="relative group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted/50 group-focus-within:text-primary transition-colors">
                {icon}
            </div>
            <input
                type={type}
                className="w-full bg-main border border-base rounded-2xl py-5 pl-16 pr-6 text-base outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold placeholder:text-muted/20"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    </div>
);

export default FormInput;
