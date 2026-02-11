import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';

const SurveyStep = ({
    questions,
    surveyAnswers,
    setSurveyAnswers,
    prevStep,
    nextStep
}) => {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
            <header className="text-center space-y-4 mb-10">
                <h2 className="text-6xl font-bold text-base italic tracking-tighter leading-none">Tu perfil</h2>
                <p className="text-muted font-bold text-[10px] tracking-[0.2em]">Cuéntanos más sobre ti</p>
            </header>

            <Card variant="surface" className="p-10 shadow-2xl space-y-8 bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />

                <div className="max-h-[40vh] overflow-y-auto pr-4 custom-scrollbar space-y-8">
                    {questions.map((q) => (
                        <div key={q.id} className="space-y-4">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{q.text}</label>
                            {q.type === 'select' ? (
                                <div className="relative group/select">
                                    <select
                                        className="w-full bg-main border border-base rounded-2xl py-5 px-6 text-sm outline-none focus:ring-2 focus:ring-primary/50 font-bold appearance-none cursor-pointer hover:border-primary/30 transition-all text-base"
                                        value={surveyAnswers[q.id] || ''}
                                        onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [q.id]: e.target.value })}
                                    >
                                        <option value="">Seleccionar una opción...</option>
                                        {Array.isArray(q.options)
                                            ? q.options.map(opt => <option key={opt.text} value={opt.text}>{opt.text}</option>)
                                            : q.options?.split(',').map(opt => <option key={opt} value={opt}>{opt}</option>)
                                        }
                                    </select>
                                    <ChevronDown size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none group-focus-within/select:text-primary" />
                                </div>
                            ) : (
                                <input
                                    type={q.type}
                                    className="w-full bg-main border border-base rounded-2xl py-5 px-6 text-sm outline-none focus:ring-2 focus:ring-primary/50 font-bold placeholder:text-muted/20 hover:border-primary/30 transition-all"
                                    placeholder="Tu respuesta aquí..."
                                    value={surveyAnswers[q.id] || ''}
                                    onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [q.id]: e.target.value })}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex gap-6 pt-4">
                    <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border border-base rounded-2xl hover:border-primary/30" icon={ChevronLeft} type="button" />
                    <Button onClick={nextStep} variant="primary" className="flex-1 h-18 text-base tracking-widest font-bold" icon={ChevronRight} type="button">
                        Casi listo
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default SurveyStep;
