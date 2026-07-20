import React from 'react';
import { ClipboardList, CheckCircle2 } from 'lucide-react';

const LeadRoadmapFormInfo = ({ formData, surveyAnswers }) => {
    return (
        <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-850 space-y-5 flex flex-col shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />
            
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <ClipboardList size={16} className="text-blue-400" />
                    Respuestas de Formulario & Encuesta
                </h4>
                {formData?.fuente_form && (
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-950 border border-slate-850 px-2.5 py-0.5 rounded-md">
                        {formData.fuente_form}
                    </span>
                )}
            </div>

            {/* Formulario de Calificación Externa n8n */}
            {formData ? (
                <div className="space-y-3 text-xs border-b border-slate-850/60 pb-4">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block">
                        Calificación Externa (n8n)
                    </span>

                    {formData.examen && (
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Examen objetivo</span>
                            <span className="font-black text-white italic">{formData.examen}</span>
                        </div>
                    )}
                    {formData.profesion && (
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Profesión</span>
                            <span className="font-bold text-slate-200">{formData.profesion}</span>
                        </div>
                    )}
                    {formData.formacion && (
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Formación / Estado</span>
                            <span className="text-slate-300 font-medium">{formData.formacion}</span>
                        </div>
                    )}
                    {formData.empleo && (
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Situación Laboral</span>
                            <span className="text-slate-300">{formData.empleo}</span>
                        </div>
                    )}
                    {formData.puntaje && (
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Puntaje a subir</span>
                            <span className="text-amber-400 font-black">{formData.puntaje}</span>
                        </div>
                    )}
                    {formData.inversion && (
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Capacidad de Inversión</span>
                            <span className="text-rose-400 font-bold">{formData.inversion}</span>
                        </div>
                    )}
                    {formData.interes && (
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Interés Principal</span>
                            <p className="text-slate-300 font-medium italic">"{formData.interes}"</p>
                        </div>
                    )}
                </div>
            ) : null}

            {/* Respuestas de Encuesta de Cita (Booking / Triage) */}
            {surveyAnswers && surveyAnswers.length > 0 ? (
                <div className="space-y-3">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block flex items-center gap-1.5">
                        <CheckCircle2 size={12} />
                        Respuestas de la Encuesta de Cita
                    </span>
                    <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-1 text-xs">
                        {surveyAnswers.map((ans, idx) => (
                            <div key={idx} className="border-l-2 border-emerald-500/40 pl-3 py-1 bg-slate-950/40 rounded-r-xl">
                                <p className="text-[10px] font-bold text-slate-400 leading-tight">{ans.question}</p>
                                <p className="text-xs font-black text-slate-100 mt-0.5">{ans.answer || 'Sin respuesta'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : !formData && (
                <div className="text-center py-8 px-4 text-slate-500 text-xs font-bold italic border border-dashed border-slate-850 rounded-2xl bg-slate-950/20 my-auto">
                    Sin respuestas de formulario o encuesta registradas
                </div>
            )}
        </div>
    );
};

export default LeadRoadmapFormInfo;
