import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Info, Target, Trophy, Lightbulb, TrendingUp, Rocket, MessageSquare } from 'lucide-react';

const CLOSER_QUESTIONS = [
    {
        key: 'daily_reflection',
        title: 'Reflection',
        icon: <MessageSquare size={16} />,
        description: 'Día Comercial',
        info: 'Habla de leads, llamadas, conversaciones, pitches, objeciones, cierres, no-shows, seguimientos y cualquier cosa relevante.',
        placeholder: 'Ej: Hoy tuve 8 leads, asistieron 6, porque 1 fue no show y el otro me reprogramó, pero ya está 100% reprogramado, todo cool...'
    },
    {
        key: 'win_of_day',
        title: 'Win',
        icon: <Trophy size={16} />,
        description: 'Victoria del día',
        info: 'Puede ser un cierre, una conversación difícil que manejaste bien, una objeción que enfrentaste mejor que antes...',
        placeholder: 'Ej: Mi victoria del día fue hacerle pitch a un lead que inicialmente dijo que solo tenía 13 USD de presupuesto...'
    },
    {
        key: 'explain_why',
        title: 'Why',
        icon: <Target size={16} />,
        description: 'Por qué fue victoria',
        info: 'No te quedes solo en lo que pasó: cuenta qué obstáculo, creencia, miedo o incomodidad atravesaste...',
        placeholder: 'Lo considero una victoria porque rompí la creencia de que un lead sin presupuesto inicial no merece una presentación...'
    },
    {
        key: 'opportunity',
        title: 'Opportunity',
        icon: <Lightbulb size={16} />,
        description: 'Mejora continua',
        info: 'Piensa en el punto más importante que, si lo mejoras, puede impactar directamente tu performance comercial.',
        placeholder: 'Ej: Mi principal oportunidad de mejora fue el premanejo de la objeción de precio...'
    },
    {
        key: 'learning_process',
        title: 'Learning',
        icon: <TrendingUp size={16} />,
        description: 'Aprendizaje',
        info: '¿Qué aprendiste hoy sobre los leads, las objeciones, el pitch, la oferta o tu forma de vender?',
        placeholder: 'Ej: Aprendí que cuando no construyo suficiente valor antes de presentar el precio, los leads interpretan la inversión como un gasto...'
    },
    {
        key: 'the_plan',
        title: 'Plan',
        icon: <Rocket size={16} />,
        description: 'Acción Concreta',
        info: 'Escribe una acción específica, observable y ejecutable. Define qué vas a hacer, cuándo lo vas a hacer.',
        placeholder: 'Ej: Mañana antes de mis llamadas voy a escribir 3 frases de premanejo de precio y practicarlas durante 10 minutos...'
    }
];

const SETTER_QUESTIONS = [
    {
        key: 'daily_reflection',
        title: 'Operations',
        icon: <MessageSquare size={16} />,
        description: 'Flujo de trabajo',
        info: 'Habla de volumen de prospección, mensajes, conversaciones abiertas, seguimientos y bookings logrados.',
        placeholder: 'Ej: Hoy inicié 50 nuevas conversaciones y retomé 30 seguimientos pendientes. Logré agendar 4 llamadas...'
    },
    {
        key: 'win_of_day',
        title: 'Win',
        icon: <Trophy size={16} />,
        description: 'Victoria del día',
        info: 'Puede ser haber agendado a un "pez gordo", rescatar a un lead que ya no respondía, manejar una objeción con éxito...',
        placeholder: 'Ej: Mi victoria fue reactivar a un lead que llevaba 10 días sin responder...'
    },
    {
        key: 'explain_why',
        title: 'Why',
        icon: <Target size={16} />,
        description: 'Por qué fue victoria',
        info: 'Describe qué barrera mental rompiste, qué técnica nueva probaste o qué cambio de enfoque te permitió avanzar.',
        placeholder: 'Lo considero una victoria porque vencí la pereza de hacer contenido personalizado para un solo lead "perdido"...'
    },
    {
        key: 'opportunity',
        title: 'Opportunity',
        icon: <Lightbulb size={16} />,
        description: 'Cuello de botella',
        info: 'Identifica el punto técnico donde te trabaste. ¿Mala calificación? ¿Lentitud en respuesta?',
        placeholder: 'Ej: Mi oportunidad de mejora es la fase de diagnóstico en el chat. Salto demasiado rápido al link de agenda...'
    },
    {
        key: 'learning_process',
        title: 'Learning',
        icon: <TrendingUp size={16} />,
        description: 'Patrones vistos',
        info: 'Describe qué disparadores funcionaron mejor o qué objeción se repitió más en el chat.',
        placeholder: 'Ej: He notado que cuando pregunto por facturación antes de generar confianza, el lead se pone a la defensiva...'
    },
    {
        key: 'the_plan',
        title: 'Plan',
        icon: <Rocket size={16} />,
        description: 'Mañana mejor',
        info: 'Escribe una acción táctica, medible y ejecutable. Define qué cambio harás en tu script.',
        placeholder: 'Ej: Mañana voy a modificar mi script de calificación: implementaré la pregunta de consecuencia...'
    }
];

const DailyReflectionSection = ({ role = 'closer', values = {}, onChange }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [activeTab, setActiveTab] = useState('daily_reflection');
    const [showInfo, setShowInfo] = useState(false);
    
    const questions = role === 'setter' ? SETTER_QUESTIONS : CLOSER_QUESTIONS;
    const currentQ = questions.find(q => q.key === activeTab) || questions[0];

    return (
        <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <TrendingUp size={18} />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Daily Reflection</h3>
                        <p className="text-[9px] font-bold text-muted uppercase tracking-widest">Mentalidad y Mejora Continua</p>
                    </div>
                </div>
                <button 
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 hover:bg-surface rounded-lg transition-colors text-muted"
                >
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-surface/30 border border-base rounded-[2.5rem] overflow-hidden"
                    >
                        {/* Tab Headers */}
                        <div className="flex p-2 gap-1 border-b border-base overflow-x-auto no-scrollbar bg-main/20">
                            {questions.map(q => (
                                <button
                                    key={q.key}
                                    type="button"
                                    onClick={() => setActiveTab(q.key)}
                                    className={`
                                        flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                                        ${activeTab === q.key 
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                            : 'text-muted hover:text-white hover:bg-surface'}
                                    `}
                                >
                                    {q.icon}
                                    {q.title}
                                    {values[q.key] && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                        {currentQ.icon}
                                        {currentQ.description}
                                    </h4>
                                    <p className="text-[10px] text-muted font-medium italic">
                                        {currentQ.placeholder.substring(0, 80)}...
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onMouseEnter={() => setShowInfo(true)}
                                    onMouseLeave={() => setShowInfo(false)}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all relative"
                                >
                                    <Info size={18} />
                                    {showInfo && (
                                        <div className="absolute right-0 top-full mt-2 z-[100] w-72 p-4 bg-zinc-900 border border-zinc-700 rounded-2xl text-[11px] text-zinc-300 leading-relaxed shadow-2xl animate-in fade-in slide-in-from-top-1">
                                            <div className="font-black text-primary uppercase mb-2 flex items-center gap-2">
                                                <Info size={12} /> Guía de Respuesta
                                            </div>
                                            {currentQ.info}
                                        </div>
                                    )}
                                </button>
                            </div>

                            <textarea
                                className="w-full h-48 p-6 bg-main/50 border border-base rounded-3xl text-sm font-medium text-text-main focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none placeholder:text-muted/20 leading-relaxed"
                                placeholder={currentQ.placeholder}
                                value={values[currentQ.key] || ''}
                                onChange={(e) => onChange(currentQ.key, e.target.value)}
                            />

                            <div className="flex justify-between items-center pt-2">
                                <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">
                                    {questions.findIndex(q => q.key === activeTab) + 1} / {questions.length} PASOS
                                </p>
                                <div className="flex gap-2">
                                    {questions.map(q => (
                                        <div 
                                            key={q.key}
                                            className={`h-1 rounded-full transition-all duration-500 ${activeTab === q.key ? 'w-8 bg-primary' : 'w-2 bg-base'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DailyReflectionSection;
