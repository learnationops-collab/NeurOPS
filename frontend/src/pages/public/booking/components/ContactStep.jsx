import React from 'react';
import { User, Instagram, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import FormInput from './FormInput';
import { COUNTRY_CODES } from '../constants';

const ContactStep = ({
    contactData,
    setContactData,
    phonePrefix,
    setPhonePrefix,
    prevStep,
    nextStep
}) => {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
            <header className="text-center space-y-4 mb-10">
                <h2 className="text-6xl font-bold text-base italic tracking-tighter leading-none">Tus datos</h2>
                <p className="text-muted font-bold text-[10px] tracking-[0.2em]">Personaliza tu experiencia</p>
            </header>

            <Card variant="surface" className="p-10 shadow-2xl space-y-8 bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />

                <div className="space-y-6">
                    <FormInput
                        label="Nombre Completo"
                        icon={<User size={20} />}
                        placeholder="Nombre y Apellido"
                        value={contactData.name}
                        onChange={(v) => setContactData({ ...contactData, name: v })}
                    />

                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted tracking-widest ml-1">WhatsApp</label>
                        <div className="flex gap-3">
                            <div className="relative group/select">
                                <select
                                    className="bg-main border border-base rounded-2xl px-4 py-5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer pr-10 hover:border-primary/30 transition-all"
                                    value={phonePrefix}
                                    onChange={(e) => setPhonePrefix(e.target.value)}
                                >
                                    {COUNTRY_CODES.map(c => <option key={c.code + c.country} value={c.code}>{c.flag} {c.code}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none group-focus-within/select:text-primary" />
                            </div>
                            <input
                                type="tel"
                                className="flex-1 bg-main border border-base rounded-2xl py-5 px-6 text-base outline-none focus:ring-2 focus:ring-primary/50 font-bold placeholder:text-muted/20 hover:border-primary/30 transition-all"
                                placeholder="123456789"
                                value={contactData.phone}
                                onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <FormInput
                        label="Instagram"
                        icon={<Instagram size={20} />}
                        placeholder="@usuario"
                        value={contactData.instagram}
                        onChange={(v) => setContactData({ ...contactData, instagram: v })}
                    />
                </div>

                <div className="flex gap-6 pt-4">
                    <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border border-base rounded-2xl hover:border-primary/30" icon={ChevronLeft} type="button" />
                    <Button
                        onClick={nextStep}
                        disabled={!contactData.name || !contactData.phone || !contactData.instagram}
                        variant="primary"
                        className="flex-1 h-18 text-base tracking-widest font-bold"
                        icon={ChevronRight}
                        type="button"
                    >
                        Continuar
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default ContactStep;
