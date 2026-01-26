import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Layers, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
    Save, X, Settings, HelpCircle, AlertCircle, Link as LinkIcon
} from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';

const FunnelsManager = () => {
    const [groups, setGroups] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(null);
    const [activeGroup, setActiveGroup] = useState(null);

    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showEventModal, setShowEventModal] = useState(false);
    const [showQuestionsModal, setShowQuestionsModal] = useState(false);

    const [editingGroup, setEditingGroup] = useState(null);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editingGroupQuestions, setEditingGroupQuestions] = useState(null);
    const [activeScope, setActiveScope] = useState('event'); // 'event', 'group', 'global'
    const [activeScopeId, setActiveScopeId] = useState(null);
    const [activeEventQuestions, setActiveEventQuestions] = useState([]);
    const [currentEventId, setCurrentEventId] = useState(null);

    const [groupName, setGroupName] = useState('');
    const [eventForm, setEventForm] = useState({
        name: '', utm_source: '', duration_minutes: 30, buffer_minutes: 15, group_id: '', min_score: 0, redirect_url_success: '', redirect_url_fail: ''
    });
    const [questionForm, setQuestionForm] = useState({
        text: '', type: 'select', options: [], order: 0, step: 'first_survey', is_active: true
    });
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [optionInput, setOptionInput] = useState({ text: '', points: 0 });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setConnectionError(null);
        try {
            const [resG, resE] = await Promise.all([
                api.get('/admin/funnels/groups'),
                api.get('/admin/funnels/events')
            ]);
            setGroups(Array.isArray(resG.data) ? resG.data : []);
            setEvents(Array.isArray(resE.data) ? resE.data : []);
        } catch (err) {
            console.error("FunnelsManager Fetch Error:", err);
            setConnectionError(err.response?.data?.error || err.message || "Error al conectar con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGroup = async () => {
        try {
            await api.post('/admin/funnels/groups', { id: editingGroup?.id, name: groupName });
            setShowGroupModal(false);
            setEditingGroup(null);
            setGroupName('');
            fetchData();
        } catch (err) { alert("Error al guardar grupo"); }
    };

    const handleSaveEvent = async () => {
        try {
            const payload = { ...eventForm, id: editingEvent?.id };
            if (!editingEvent) await api.post('/admin/funnels/events', payload);
            else await api.put('/admin/funnels/events', payload);

            setShowEventModal(false);
            setEditingEvent(null);
            fetchData();
        } catch (err) { alert("Error al guardar evento: " + (err.response?.data?.error || err.message)); }
    };

    const handleDeleteEvent = async (id) => {
        if (!confirm("¿Eliminar evento? Esto borrará sus preguntas asociadas.")) return;
        try {
            await api.delete(`/admin/funnels/events?id=${id}`);
            fetchData();
        } catch (err) { alert("Error al eliminar"); }
    };

    const openQuestions = async (scope, id, title) => {
        setActiveScope(scope);
        setActiveScopeId(id);
        setEditingEvent({ name: title }); // Hack for modal title

        let url = '';
        if (scope === 'global') url = '/admin/funnels/questions/global';
        else if (scope === 'group') url = `/admin/funnels/groups/${id}/questions`;
        else url = `/admin/funnels/events/${id}/questions`;

        try {
            const res = await api.get(url);
            // Parse options if they are stored as JSON string
            const parsed = res.data.map(q => ({
                ...q,
                options: q.options ? (typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : q.options) : []
            }));
            setActiveEventQuestions(parsed);
            setShowQuestionsModal(true);
        } catch (err) { alert("Error cargando preguntas"); }
    };

    const handleSaveQuestion = async () => {
        let url = '';
        if (activeScope === 'global') url = '/admin/funnels/questions/global';
        else if (activeScope === 'group') url = `/admin/funnels/groups/${activeScopeId}/questions`;
        else url = `/admin/funnels/events/${activeScopeId}/questions`;

        try {
            await api.post(url, {
                id: editingQuestionId,
                ...questionForm,
                options: JSON.stringify(questionForm.options)
            });
            const res = await api.get(url);
            const parsed = res.data.map(q => ({
                ...q,
                options: q.options ? (typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : q.options) : []
            }));
            setActiveEventQuestions(parsed);
            setQuestionForm({ text: '', type: 'select', options: [], order: 0, step: 'first_survey', is_active: true });
            setEditingQuestionId(null);
        } catch (err) { alert("Error guardando pregunta"); }
    };

    const handleDeleteQuestion = async (id) => {
        try {
            await api.delete(`/admin/funnels/questions/${id}`);
            let url = '';
            if (activeScope === 'global') url = '/admin/funnels/questions/global';
            else if (activeScope === 'group') url = `/admin/funnels/groups/${activeScopeId}/questions`;
            else url = `/admin/funnels/events/${activeScopeId}/questions`;
            const res = await api.get(url);
            const parsed = res.data.map(q => ({
                ...q,
                options: q.options ? (typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : q.options) : []
            }));
            setActiveEventQuestions(parsed);
        } catch (err) { alert("Error eliminando pregunta"); }
    };

    const getEventsByGroup = (gId) => events.filter(e => e.group_id === parseInt(gId) || e.group_id === gId);

    if (loading) return (
        <div className="p-20 text-center animate-pulse">
            <Layers className="mx-auto mb-4 text-primary opacity-20" size={48} />
            <p className="text-xs uppercase tracking-widest font-black text-muted">Cargando Embudos...</p>
        </div>
    );

    return (
        <div className="space-y-8 min-h-[400px]">
            {connectionError && (
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-500 shadow-lg">
                    <AlertCircle className="w-8 h-8 shrink-0" />
                    <div className="space-y-1 text-left">
                        <p className="font-black uppercase tracking-widest text-xs">Error de Servidor</p>
                        <p className="text-[10px] font-medium opacity-80 uppercase tracking-tight">{connectionError}</p>
                    </div>
                    <Button variant="ghost" size="xs" className="ml-auto text-red-500 hover:bg-red-500/10" onClick={fetchData}>Reintentar</Button>
                </div>
            )}

            <header className="flex justify-between items-center bg-surface p-6 rounded-[2rem] border border-base shadow-lg bg-main/30 backdrop-blur-lg">
                <div className="space-y-1 text-left">
                    <h3 className="text-2xl font-black text-base italic tracking-tighter uppercase relative">
                        Gestión de Embudos
                    </h3>
                    <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Configura tus landing pages y segmentación</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="ghost" size="xs" icon={HelpCircle} onClick={() => openQuestions('global', 0, 'Preguntas Globales')}>
                        Globales
                    </Button>
                    <Button variant="outline" size="xs" icon={Plus} onClick={() => { setEditingGroup(null); setGroupName(''); setShowGroupModal(true); }}>
                        Grupo
                    </Button>
                    <Button variant="primary" size="xs" icon={Plus} onClick={() => {
                        if (groups.length === 0) {
                            alert("Primero debes crear al menos un Grupo.");
                            return;
                        }
                        setEditingEvent(null);
                        setEventForm({ name: '', utm_source: '', duration_minutes: 30, buffer_minutes: 15, group_id: groups[0]?.id || '', min_score: 0 });
                        setShowEventModal(true);
                    }}>
                        Nuevo Evento
                    </Button>
                </div>
            </header>

            <div className="grid gap-6">
                {groups.length === 0 ? (
                    <Card variant="surface" className="p-20 text-center space-y-6 border-dashed border-2 flex flex-col items-center bg-surface/50">
                        <div className="w-16 h-16 bg-main rounded-full flex items-center justify-center text-muted border border-base">
                            <Layers size={32} className="opacity-30" />
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-xl font-bold uppercase italic tracking-tighter">No hay Embudos configurados</h4>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest max-w-xs mx-auto opacity-70">Crea un grupo para comenzar a organizar tus eventos.</p>
                        </div>
                        <Button variant="primary" icon={Plus} onClick={() => { setEditingGroup(null); setGroupName(''); setShowGroupModal(true); }}>
                            Crear Mi Primer Grupo
                        </Button>
                    </Card>
                ) : (
                    groups.map(group => (
                        <div key={group.id} className="bg-surface border border-base rounded-2xl overflow-hidden shadow-lg transition-all hover:shadow-2xl">
                            <div
                                className="p-6 flex items-center justify-between cursor-pointer bg-surface-hover/20 hover:bg-surface-hover/40 transition-colors"
                                onClick={() => setActiveGroup(activeGroup === group.id ? null : group.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg transition-all ${activeGroup === group.id ? 'bg-primary text-white' : 'bg-main text-muted'}`}>
                                        <ChevronRight size={16} className={`transition-transform duration-300 ${activeGroup === group.id ? 'rotate-90' : ''}`} />
                                    </div>
                                    <h3 className="text-lg font-black uppercase tracking-tight">{group.name}</h3>
                                    <Badge variant="neutral">{getEventsByGroup(group.id).length} Eventos</Badge>
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => openQuestions('group', group.id, `Grupo: ${group.name}`)} className="p-2 text-muted hover:text-primary transition-colors">
                                        <HelpCircle size={16} />
                                    </button>
                                    <button onClick={() => { setEditingGroup(group); setGroupName(group.name); setShowGroupModal(true); }} className="p-2 text-muted hover:text-primary transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {activeGroup === group.id && (
                                <div className="border-t border-base bg-main/5 p-4 space-y-3">
                                    {getEventsByGroup(group.id).length === 0 ? (
                                        <div className="p-10 text-center border border-dashed border-base rounded-2xl">
                                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest italic mb-4">Sin eventos en este grupo</p>
                                            <Button size="xs" variant="outline" icon={Plus} onClick={() => {
                                                setEditingEvent(null);
                                                setEventForm({ name: '', utm_source: '', duration_minutes: 30, buffer_minutes: 15, group_id: group.id, min_score: 0 });
                                                setShowEventModal(true);
                                            }}>Crear Evento en {group.name}</Button>
                                        </div>
                                    ) : (
                                        getEventsByGroup(group.id).map(event => (
                                            <Card key={event.id} variant="surface" className="flex items-center justify-between p-4 group border-transparent hover:border-primary/20 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black shadow-inner">
                                                        {event.name[0]}
                                                    </div>
                                                    <div className="text-left">
                                                        <h4 className="font-bold text-sm tracking-tight">{event.name}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant="outline" size="sm" className="text-[8px] opacity-70">/{event.utm_source}</Badge>
                                                            <Badge variant="neutral" size="sm" className="text-[8px] opacity-70">{event.duration_minutes} min</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button size="xs" variant="ghost" icon={HelpCircle} onClick={() => openQuestions('event', event.id, event.name)} className="hover:bg-primary/10 hover:text-primary transition-all" />
                                                    <Button size="xs" variant="ghost" icon={Edit2} onClick={() => { setEditingEvent(event); setEventForm(event); setShowEventModal(true); }} className="hover:bg-primary/20 hover:text-primary transition-all" />
                                                    <Button size="xs" variant="primary" icon={LinkIcon} onClick={() => window.open(`/book/${event.utm_source}`, '_blank')} className="shadow-lg shadow-primary/20" />
                                                    <Button size="xs" variant="ghost" icon={Trash2} onClick={() => handleDeleteEvent(event.id)} className="hover:text-red-500 hover:bg-red-500/10" />
                                                </div>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )))}
            </div>

            {/* Modals */}
            {showGroupModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <Card className="w-full max-w-sm space-y-6 shadow-2xl border-white/5 animate-in zoom-in-95 duration-300">
                        <header>
                            <h3 className="text-xl font-black uppercase tracking-tight italic">Configurar Grupo</h3>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Categoriza tus embudos de venta</p>
                        </header>
                        <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ej: Tráfico Pagado, Orgánico..." className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="ghost" onClick={() => setShowGroupModal(false)}>Cancelar</Button>
                            <Button variant="primary" onClick={handleSaveGroup} className="px-10">Guardar</Button>
                        </div>
                    </Card>
                </div>
            )}

            {showEventModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <Card className="w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl border-white/5 animate-in zoom-in-95 duration-300">
                        <header className="border-b border-base pb-6">
                            <h3 className="text-xl font-black uppercase tracking-tight italic">Configuración de Evento</h3>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Define el link y la duración</p>
                        </header>
                        <div className="grid grid-cols-2 gap-6 text-left">
                            <div className="col-span-2 space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Nombre Comercial</label>
                                <input value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} placeholder="Ej: Llamada de Estrategia" className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="col-span-2 space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Identificador de Link (URL)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">/book/</span>
                                    <input value={eventForm.utm_source} onChange={e => setEventForm({ ...eventForm, utm_source: e.target.value })} placeholder="vsl-promo" className="w-full bg-main border border-base rounded-xl py-4 pl-16 pr-4 font-black text-sm outline-none focus:ring-2 focus:ring-primary/50 text-primary" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Duración (Min)</label>
                                <input type="number" value={eventForm.duration_minutes} onChange={e => setEventForm({ ...eventForm, duration_minutes: e.target.value })} className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Puntaje Mínimo</label>
                                <input type="number" value={eventForm.min_score} onChange={e => setEventForm({ ...eventForm, min_score: parseInt(e.target.value) || 0 })} className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none" placeholder="0" />
                            </div>
                            <div className="col-span-2 space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">URL Redirección Éxito (Calificado)</label>
                                <input value={eventForm.redirect_url_success} onChange={e => setEventForm({ ...eventForm, redirect_url_success: e.target.value })} placeholder="https://..." className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none" />
                            </div>
                            <div className="col-span-2 space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">URL Redirección Fallo (Descalificado)</label>
                                <input value={eventForm.redirect_url_fail} onChange={e => setEventForm({ ...eventForm, redirect_url_fail: e.target.value })} placeholder="https://..." className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none" />
                            </div>
                            <div className="col-span-2 space-y-3">
                                <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Asignar Grupo</label>
                                <select value={eventForm.group_id} onChange={e => setEventForm({ ...eventForm, group_id: e.target.value })} className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none cursor-pointer">
                                    <option value="">Selecciona un grupo...</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-6 border-t border-base">
                            <Button variant="ghost" onClick={() => setShowEventModal(false)}>Cancelar</Button>
                            <Button variant="primary" onClick={handleSaveEvent} className="px-10">Guardar Evento</Button>
                        </div>
                    </Card>
                </div>
            )}

            {showQuestionsModal && (
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
                            <Button variant="ghost" size="sm" icon={X} onClick={() => setShowQuestionsModal(false)} className="rounded-full hover:bg-main" />
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
                                            <Button variant="ghost" className="w-full h-12" onClick={() => { setEditingQuestionId(null); setQuestionForm({ text: '', type: 'text', options: '', order: 0, step: 'first_survey', is_active: true }); }}>
                                                Descartar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default FunnelsManager;
