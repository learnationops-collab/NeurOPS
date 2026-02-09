import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, X, Send, Calendar } from 'lucide-react';

const SetterReportModal = ({ isOpen, onClose, onSuccess }) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        inbound_leads: 0,
        openings: 0,
        not_lead: 0,
        new_offers: 0,
        links_sent: 0,
        appointments_booked: 0,
        follow_ups: 0,
        answers: []
    });

    useEffect(() => {
        if (isOpen) fetchQuestions();
    }, [isOpen]);

    const fetchQuestions = async () => {
        setLoading(true);
        console.log("Fetching setter questions...");
        try {
            const res = await api.get('/setter/questions');
            console.log("Questions received:", res.data);
            setQuestions(res.data);
            // Inicializar respuestas
            setFormData(prev => ({
                ...prev,
                answers: res.data.map(q => ({ question_id: q.id, answer: '' }))
            }));
        } catch (err) {
            console.error("Error fetching questions:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatChange = (field, value) => {
        setFormData({ ...formData, [field]: parseInt(value) || 0 });
    };

    const handleAnswerChange = (questionId, value) => {
        setFormData(prev => ({
            ...prev,
            answers: prev.answers.map(a =>
                a.question_id === questionId ? { ...a, answer: value } : a
            )
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/setter/report', formData);
            alert('Reporte enviado correctamente');
            onSuccess?.();
            onClose();
        } catch (err) {
            alert(err.response?.data?.message || 'Error al enviar el reporte');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative bg-slate-900 border border-slate-700/50 w-full max-w-2xl max-h-[90vh] min-h-[400px] overflow-hidden rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col z-10">
                {/* Header */}
                <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Reporte Diario Setter</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Completa tus métricas del día</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
                    ) : (
                        <form id="setter-report-form" onSubmit={handleSubmit} className="space-y-8">
                            {/* Fecha */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Calendar size={12} /> Fecha del Informe
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>

                            {/* Métricas Fijas */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                    { label: 'Entrantes', field: 'inbound_leads' },
                                    { label: 'Aperturas', field: 'openings' },
                                    { label: 'No Lead', field: 'not_lead' },
                                    { label: 'Invitaciones/Ofertas', field: 'new_offers' },
                                    { label: 'Links Enviados', field: 'links_sent' },
                                    { label: 'Agendas', field: 'appointments_booked' },
                                    { label: 'Seguimientos', field: 'follow_ups' },
                                ].map(stat => (
                                    <div key={stat.field} className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{stat.label}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full px-5 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center"
                                            value={formData[stat.field]}
                                            onChange={e => handleStatChange(stat.field, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Preguntas Dinámicas */}
                            {questions.length > 0 && (
                                <div className="space-y-6 pt-6 border-t border-slate-800/50">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Preguntas del Administrador</h3>
                                    {questions.map(q => (
                                        <div key={q.id} className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{q.text}</label>
                                            {q.type === 'long_text' ? (
                                                <textarea
                                                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold min-h-[100px]"
                                                    value={formData.answers.find(a => a.question_id === q.id)?.answer || ''}
                                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                />
                                            ) : q.type === 'boolean' ? (
                                                <div className="flex gap-4">
                                                    {['Si', 'No'].map(opt => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => handleAnswerChange(q.id, opt)}
                                                            className={`flex-1 py-3 rounded-xl font-bold transition-all border ${formData.answers.find(a => a.question_id === q.id)?.answer === opt
                                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                                                : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
                                                                }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <input
                                                    type={q.type === 'number' ? 'number' : 'text'}
                                                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                                    value={formData.answers.find(a => a.question_id === q.id)?.answer || ''}
                                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-800 bg-slate-900/50">
                    <button
                        type="submit"
                        form="setter-report-form"
                        disabled={submitting || loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
                    >
                        {submitting ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <Send size={18} />
                        )}
                        {submitting ? 'Enviando...' : 'Enviar Reporte del Día'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetterReportModal;
