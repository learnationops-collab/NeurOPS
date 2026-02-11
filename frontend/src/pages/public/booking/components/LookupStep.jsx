import React from 'react';
import { User, CheckCircle2, ChevronRight, CalendarDays } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import FormInput from './FormInput';

const LookupStep = ({
    lookupValue,
    setLookupValue,
    emailChecking,
    handleLookupNext,
    recognizedUser,
    setRecognizedUser,
    setCurrentStep,
    username
}) => {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <header className="text-center space-y-4 mb-10">
                <h2 className="text-6xl font-bold text-base italic tracking-tighter leading-tight">Empecemos</h2>
                <p className="text-muted font-bold text-[10px] tracking-[0.2em]">Ingresa tu email o Instagram para continuar</p>
            </header>

            <Card variant="surface" className="p-10 shadow-2xl space-y-8 bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                {/* Decorative background element for the card */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />

                {!recognizedUser ? (
                    <div className="space-y-8">
                        <FormInput
                            label="Tu Email o Instagram"
                            type="text"
                            icon={<User size={20} />}
                            placeholder="ejemplo@mail.com o @usuario"
                            value={lookupValue}
                            onChange={(v) => {
                                setLookupValue(v);
                                // Reset recognized status if they type a different identifier after seeing it
                                if (recognizedUser) setRecognizedUser(false);
                            }}
                        />

                        <Button
                            onClick={handleLookupNext}
                            disabled={!lookupValue || emailChecking}
                            loading={emailChecking}
                            variant="primary"
                            className="w-full h-18 text-base tracking-widest font-bold"
                            icon={ChevronRight}
                            type="button"
                        >
                            Verificar identidad
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-10 animate-in zoom-in-95 duration-500">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                                <CheckCircle2 className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-2xl font-bold text-base uppercase tracking-tight italic">¡Hola de nuevo!</h3>
                            <p className="text-muted font-bold uppercase text-[10px] tracking-widest px-4">
                                Parece que ya habías agendado previamente con nosotros, te gustaría:
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <Button
                                onClick={() => {
                                    setRecognizedUser(false);
                                    setCurrentStep(2);
                                }}
                                variant="outline"
                                className="h-16 text-[10px] tracking-[0.2em] border-primary/20 text-primary hover:bg-primary/5"
                                type="button"
                            >
                                Modificar mis respuestas
                            </Button>
                            <Button
                                onClick={() => {
                                    setRecognizedUser(false);
                                    setCurrentStep(4);
                                }}
                                variant="primary"
                                className="h-18 text-[11px] font-bold tracking-[0.3em]"
                                icon={CalendarDays}
                                type="button"
                            >
                                Ir directo al agendamiento
                            </Button>
                        </div>

                        <button
                            onClick={() => setRecognizedUser(false)}
                            className="w-full text-[8px] font-bold tracking-[0.4em] text-muted hover:text-primary transition-colors mt-4"
                        >
                            O usa un dato diferente
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default LookupStep;
