import React from 'react';
import { HelpCircle, X, Edit2, Trash2, Plus } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const QuestionsModal = ({
    editingEvent,
    activeScope,
    activeEventQuestions,
    onClose,
    editingQuestionId,
    setEditingQuestionId,
    questionForm,
    setQuestionForm,
    optionInput,
    setOptionInput,
    handleSaveQuestion,
    handleDeleteQuestion
}) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <Card className="w-full max-w-5xl space-y-6 h-[85vh] flex flex-col shadow-2xl border-white/5 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center px-10 pt-10 pb-6 border-b border-base bg-surface-hover/20">
                    <div className="text-left">
                        <h3 className="text-2xl font-black uppercase tracking-tight italic text-base">Cualificación: {editingEvent?.name}</h3>
                        <p className="text-muted text-[10px] font-bold uppercase tracking-widest mt-1">
                            Configurando preguntas a nivel:
                            <span className="text-primary ml-2">{activeScope === 'global' ? 'GLOBAL' : activeScope === 'group' ? 'GRUPO' : 'EVENTO'}</span>
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" icon={X} onClick={onClose} className="rounded-full hover:bg-main" />
                </div>

                <div className="flex-1 overflow-hidden flex gap-0">
                    {/* Questions List */}
                    <div className="w-3/5 overflow-y-auto p-10 space-y-4 custom-scrollbar bg-main/10 text-left">
                        {activeEventQuestions.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 py-20">
                                <HelpCircle size={48} className="text-muted" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">No hay preguntas configuradas</p>
                            </div>
                        )}
                        {activeEventQuestions.map((q, idx) => (
                            <div key={q.id} className="p-6 bg-surface rounded-3xl border border-base flex justify-between items-start group hover:border-primary/30 transition-all shadow-sm">
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-main flex items-center justify-center text-[10px] font-black text-muted border border-base shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm tracking-tight">{q.text}</p>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <Badge size="xs" variant="neutral" className="px-2">{q.type}</Badge>
                                            {Array.isArray(q.options) && q.options.length > 0 && (
                                                <Badge size="xs" variant="outline" className="px-2">
                                                    {q.options.length} Opciones • Max {Math.max(...q.options.map(o => o.points || 0), 0)} pts
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingQuestionId(q.id); setQuestionForm({ text: q.text, type: q.type, options: [...(q.options || [])], order: q.order, step: q.step, is_active: q.is_active }); }} className="p-2 text-muted hover:text-primary transition-all rounded-lg hover:bg-primary/10"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 text-muted hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Questions Editor Form */}
                    <div className="w-2/5 p-10 border-l border-base bg-surface overflow-y-auto custom-scrollbar text-left">
                        <div className="space-y-6">
                            <header className="space-y-1">
                                <h4 className="font-black text-xs uppercase tracking-widest text-primary">Editor de Pregunta</h4>
                                <p className="text-[9px] text-muted font-medium uppercase tracking-[0.1em]">{editingQuestionId ? 'Actualizando pregunta' : 'Crea una nueva pregunta'}</p>
                            </header>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-muted tracking-widest">Enunciado</label>
                                    <textarea value={questionForm.text} onChange={e => setQuestionForm({ ...questionForm, text: e.target.value })} placeholder="Ej: ¿Cual es tu facturacion mensual?" className="w-full bg-main border border-base rounded-2xl p-5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/50 transition-all h-24 resize-none" />
                                </div>
                                <div className="space-y-2 animate-in slide-in-from-top-2">
                                    <label className="text-[9px] font-black uppercase text-muted tracking-widest">Configurar Opciones y Puntos</label>

                                    <div className="space-y-3">
                                        {/* Option Adder */}
                                        <div className="flex gap-2">
                                            <input
                                                value={optionInput.text}
                                                onChange={e => setOptionInput({ ...optionInput, text: e.target.value })}
                                                placeholder="Opción"
                                                className="flex-1 bg-main border border-base rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                            />
                                            <input
                                                type="number"
                                                value={optionInput.points}
                                                onChange={e => setOptionInput({ ...optionInput, points: parseInt(e.target.value) || 0 })}
                                                placeholder="Pts"
                                                className="w-20 bg-main border border-base rounded-xl px-4 py-2 text-xs font-bold outline-none"
                                            />
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                onClick={() => {
                                                    if (!optionInput.text) return;
                                                    setQuestionForm({
                                                        ...questionForm,
                                                        options: [...(questionForm.options || []), { ...optionInput }]
                                                    });
                                                    setOptionInput({ text: '', points: 0 });
                                                }}
                                                icon={Plus}
                                            />
                                        </div>

                                        {/* Options List */}
                                        <div className="space-y-2 bg-main/30 p-3 rounded-2xl border border-base max-h-40 overflow-y-auto custom-scrollbar">
                                            {(questionForm.options || []).length === 0 && <p className="text-[9px] text-muted uppercase italic text-center py-2">Sin opciones añadidas</p>}
                                            {(questionForm.options || []).map((opt, i) => (
                                                <div key={i} className="flex items-center justify-between bg-surface p-2 rounded-lg border border-base/50 text-[11px] font-bold gap-3">
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <input
                                                            type="number"
                                                            value={opt.points}
                                                            onChange={(e) => {
                                                                const next = [...questionForm.options];
                                                                next[i] = { ...next[i], points: parseInt(e.target.value) || 0 };
                                                                setQuestionForm({ ...questionForm, options: next });
                                                            }}
                                                            className="w-12 bg-main border border-base rounded-md px-1 py-1 text-center text-primary outline-none focus:ring-1 focus:ring-primary/50"
                                                        />
                                                        <span className="text-[8px] text-muted uppercase">pts</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={opt.text}
                                                        onChange={(e) => {
                                                            const next = [...questionForm.options];
                                                            next[i] = { ...next[i], text: e.target.value };
                                                            setQuestionForm({ ...questionForm, options: next });
                                                        }}
                                                        className="flex-1 bg-transparent border-none outline-none focus:bg-main/50 rounded-md px-2 py-1 text-xs transition-all"
                                                        placeholder="Texto de la opción"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const next = [...questionForm.options];
                                                            next.splice(i, 1);
                                                            setQuestionForm({ ...questionForm, options: next });
                                                        }}
                                                        className="text-muted hover:text-red-500 transition-colors p-1"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase text-muted tracking-widest">Orden</label>
                                        <input type="number" value={questionForm.order} onChange={e => setQuestionForm({ ...questionForm, order: parseInt(e.target.value) })} className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none" />
                                    </div>
                                    <div className="flex items-end justify-center pb-4">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-10 h-6 rounded-full transition-all relative ${questionForm.is_active ? 'bg-primary' : 'bg-base'}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${questionForm.is_active ? 'left-5' : 'left-1'}`} />
                                            </div>
                                            <input type="checkbox" className="hidden" checked={questionForm.is_active} onChange={e => setQuestionForm({ ...questionForm, is_active: e.target.checked })} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Aceptada</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-4 space-y-3">
                                <Button variant="primary" className="w-full h-14" onClick={handleSaveQuestion}>
                                    {editingQuestionId ? 'Confirmar Cambios' : 'Añadir al Cuestionario'}
                                </Button>
                                {editingQuestionId && (
                                    <Button variant="ghost" className="w-full h-12" onClick={() => { setEditingQuestionId(null); setQuestionForm({ text: '', type: 'text', options: [], order: 0, step: 'first_survey', is_active: true }); }}>
                                        Descartar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default QuestionsModal;
