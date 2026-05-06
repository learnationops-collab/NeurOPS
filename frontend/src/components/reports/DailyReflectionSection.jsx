import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

// Preguntas por rol
const CLOSER_QUESTIONS = [
    {
        key: 'daily_reflection',
        title: 'Daily Reflection',
        description: 'Cuéntame cómo fue tu día comercial.',
        info: 'Habla de leads, llamadas, conversaciones, pitches, objeciones, cierres, no-shows, seguimientos y cualquier cosa relevante.',
        placeholder: 'Ej: Hoy tuve 8 leads, asistieron 6, porque 1 fue no show y el otro me reprogramó, pero ya está 100% reprogramado, todo cool. De esas 6 calls tomadas, hice 4 ofertas, las otras 2 se dividen en 1 que no tenía un centavo y no quise extenderme, y la otra que tomaba decisión con los padres. Entonces estamos en proceso de reagendar, no pude reagendarla en vivo. Hice 2 cierres, un PIF de 1.5k uno para RR y otro de 2k para SI, en Split Pay.'
    },
    {
        key: 'win_of_day',
        title: 'Win of the day',
        description: '¿Cuál fue tu victoria del día?',
        info: 'Puede ser un cierre, una conversación difícil que manejaste bien, una objeción que enfrentaste mejor que antes, una acción que normalmente habrías evitado, una mejora en tu proceso o una decisión comercial que te dejó aprendizaje.',
        placeholder: 'Ej: Mi victoria del día fue hacerle pitch a un lead que inicialmente dijo que solo tenía 13 USD de presupuesto. Normalmente habría descartado rápido esa conversación, pero decidí avanzar para probar el nuevo pitch, entender mejor su dolor y ver si podía construir valor antes de asumir que no calificaba.'
    },
    {
        key: 'explain_why',
        title: 'Explain why',
        description: 'Explica por qué eso fue una victoria.',
        info: 'No te quedes solo en lo que pasó: cuenta qué obstáculo, creencia, miedo o incomodidad atravesaste, qué intentaste probar o validar, qué aprendiste y qué te demuestra sobre tu proceso comercial.',
        placeholder: 'Lo considero una victoria porque rompí la creencia de que un lead sin presupuesto inicial no merece una presentación. Atravesé la incomodidad de sentir que podía estar perdiendo el tiempo, pero usé la conversación para validar si el nuevo pitch generaba interés incluso con una barrera económica fuerte...'
    },
    {
        key: 'opportunity',
        title: 'Opportunity',
        description: '¿Cuál fue tu principal oportunidad de mejora hoy?',
        info: 'Piensa en el punto más importante que, si lo mejoras, puede impactar directamente tu performance comercial. No escribas algo genérico como "mejorar objeciones". Especifica qué parte exacta debes mejorar.',
        placeholder: 'Ej: Mi principal oportunidad de mejora fue el premanejo de la objeción de precio. Hoy noté que esperé demasiado a que el lead dijera que no tenía presupuesto, en vez de anticipar esa resistencia durante el pitch y construir mejor el valor antes de hablar de inversión...'
    },
    {
        key: 'learning_process',
        title: 'The Learning Process',
        description: '¿Qué aprendiste hoy sobre los leads, las objeciones, el pitch, la oferta o tu forma de vender?',
        info: 'No pongas solo "aprendí que debo mejorar". Cuenta qué patrón viste, qué comportamiento se repitió, qué reacción tuvieron los leads, qué parte del pitch funcionó, qué parte generó fricción o qué descubriste sobre tu manera de vender.',
        placeholder: 'Ej: Aprendí que cuando no construyo suficiente valor antes de presentar el precio, los leads interpretan la inversión como un gasto y no como una solución a un problema urgente...'
    },
    {
        key: 'the_plan',
        title: 'The Plan',
        description: '¿Cómo lo vas a mejorar concretamente?',
        info: 'Escribe una acción específica, observable y ejecutable. Nada de "voy a tener mejor actitud". Define qué vas a hacer, cuándo lo vas a hacer y cómo sabrás que lo hiciste.',
        placeholder: 'Ej: Mañana antes de mis llamadas voy a escribir 3 frases de premanejo de precio y practicarlas durante 10 minutos. Luego las voy a usar en al menos 2 conversaciones antes de presentar la inversión...'
    }
];

const SETTER_QUESTIONS = [
    {
        key: 'daily_reflection',
        title: 'Daily Operations',
        description: 'Cuéntame cómo fue tu flujo de trabajo hoy.',
        info: 'Habla de volumen de prospección, mensajes nuevos enviados, conversaciones abiertas, seguimientos realizados, leads calificados y, sobre todo, cuántos bookings (citas agendadas) lograste o cuántos leads pasaste al closer.',
        placeholder: 'Ej: Hoy inicié 50 nuevas conversaciones y retomé 30 seguimientos pendientes. Tuve un flujo alto en Instagram pero algo lento en LinkedIn. Logré agendar 4 llamadas confirmadas...'
    },
    {
        key: 'win_of_day',
        title: 'Win of the day',
        description: '¿Cuál fue tu victoria del día?',
        info: 'Puede ser haber agendado a un "pez gordo", rescatar a un lead que ya no respondía, manejar una objeción de "envíame la información por mail" con éxito, o haber mantenido el volumen de mensajes a pesar de un día de baja energía.',
        placeholder: 'Ej: Mi victoria fue reactivar a un lead que llevaba 10 días sin responder. En lugar de enviar el típico "¿sigues ahí?", usé un video corto de 30 segundos personalizando el valor de nuestra solución para su caso específico. Respondió a los 5 minutos y terminamos agendando para el jueves.'
    },
    {
        key: 'explain_why',
        title: 'Explain why',
        description: 'Explica por qué eso fue una victoria.',
        info: 'No te quedes en el resultado: describe qué barrera mental rompiste, qué técnica nueva probaste o qué cambio de enfoque te permitió avanzar en el funnel donde antes te trababas.',
        placeholder: 'Lo considero una victoria porque vencí la pereza de hacer contenido personalizado para un solo lead "perdido". Me demostró que el seguimiento creativo y de alto valor rompe el ruido mucho más que la insistencia genérica...'
    },
    {
        key: 'opportunity',
        title: 'Opportunity',
        description: '¿Cuál fue tu principal oportunidad de mejora hoy?',
        info: 'Identifica el cuello de botella técnico de tu día. ¿Estás perdiendo leads en la transición al cierre? ¿Tu calificación es muy floja y agendas gente sin dinero? ¿Tardas mucho en responder y el lead se enfría? Sé específico.',
        placeholder: 'Ej: Mi oportunidad de mejora es la fase de diagnóstico en el chat. Noté que salto demasiado rápido al link de agenda sin haber rascado lo suficiente en el "dolor" del prospecto...'
    },
    {
        key: 'learning_process',
        title: 'The Learning Process',
        description: '¿Qué patrones o comportamientos notaste hoy en los leads?',
        info: 'Evita frases vacías. Describe qué disparadores (triggers) funcionaron mejor, qué objeción se repitió más en el chat o en qué punto exacto de la conversación se está perdiendo el interés de la gente.',
        placeholder: 'Ej: He notado un patrón: cuando pregunto directamente por la facturación actual antes de generar confianza, el lead se pone a la defensiva o deja de responder. Sin embargo, si primero pregunto por el tamaño del equipo o el objetivo del trimestre, sueltan el dato financiero con más naturalidad después...'
    },
    {
        key: 'the_plan',
        title: 'The Plan',
        description: '¿Cómo lo vas a mejorar concretamente mañana?',
        info: 'Escribe una acción táctica, medible y ejecutable. Define qué cambio harás en tu script o en tu gestión de tiempo y cómo verificarás que funcionó.',
        placeholder: 'Ej: Mañana voy a modificar mi script de calificación: antes de pedir la cita, voy a implementar la pregunta de "consecuencia" (¿qué pasa si no solucionas esto en los próximos 3 meses?). Aplicaré esto en todas mis conversaciones nuevas del día...'
    }
];

// Tooltip flotante
const Tooltip = ({ text }) => (
    <div className="absolute left-0 top-full mt-2 z-50 w-72 p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-[11px] text-zinc-300 leading-relaxed shadow-2xl pointer-events-none">
        {text}
    </div>
);

// Item de pregunta individual
const QuestionItem = ({ q, value, onChange }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest">
                    {q.title}
                </label>
                <span className="text-[10px] text-zinc-400 font-medium">— {q.description}</span>
                <div
                    className="relative ml-auto flex-shrink-0"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <Info size={13} className="text-zinc-500 hover:text-primary cursor-help transition-colors" />
                    {showTooltip && <Tooltip text={q.info} />}
                </div>
            </div>
            <textarea
                className="w-full px-5 py-4 bg-main border border-base rounded-2xl text-sm font-medium text-text-main focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[100px] resize-none placeholder:text-muted/30 leading-relaxed"
                placeholder={q.placeholder}
                value={value || ''}
                onChange={(e) => onChange(q.key, e.target.value)}
            />
        </div>
    );
};

const DailyReflectionSection = ({ role = 'closer', values = {}, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const questions = role === 'setter' ? SETTER_QUESTIONS : CLOSER_QUESTIONS;

    return (
        <div className="rounded-3xl border border-base overflow-hidden">
            {/* Header colapsable */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between p-6 bg-surface/50 hover:bg-surface transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                        Daily Reflection
                    </span>
                    <span className="text-[9px] font-bold text-muted bg-main px-3 py-1 rounded-full">
                        {questions.length} preguntas
                    </span>
                </div>
                {isOpen
                    ? <ChevronUp size={18} className="text-muted" />
                    : <ChevronDown size={18} className="text-muted" />
                }
            </button>

            {/* Contenido desplegable */}
            {isOpen && (
                <div className="p-6 space-y-6 border-t border-base bg-main/20">
                    {questions.map(q => (
                        <QuestionItem
                            key={q.key}
                            q={q}
                            value={values[q.key]}
                            onChange={onChange}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default DailyReflectionSection;
