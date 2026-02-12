import { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    Layers, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
    Save, X, Settings, HelpCircle, AlertCircle, Link as LinkIcon
} from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

// Modular Components
import GroupModal from '../funnels/GroupModal';
import EventModal from '../funnels/EventModal';
import QuestionsModal from '../funnels/QuestionsModal';

const FunnelsManager = () => {
    const [groups, setGroups] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(null);
    const [activeGroup, setActiveGroup] = useState(null);
    const [allUsers, setAllUsers] = useState([]);

    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showEventModal, setShowEventModal] = useState(false);
    const [showQuestionsModal, setShowQuestionsModal] = useState(false);

    const [editingGroup, setEditingGroup] = useState(null);
    const [editingEvent, setEditingEvent] = useState(null);
    const [activeScope, setActiveScope] = useState('event'); // 'event', 'group', 'global'
    const [activeScopeId, setActiveScopeId] = useState(null);
    const [activeEventQuestions, setActiveEventQuestions] = useState([]);

    const [groupName, setGroupName] = useState('');
    const [eventForm, setEventForm] = useState({
        name: '', utm_source: '', duration_minutes: 30, buffer_minutes: 15, group_id: '', min_score: 0, redirect_url_success: '', redirect_url_fail: '', setter_id: '', closer_ids: []
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
            const [resG, resE, resU] = await Promise.all([
                api.get('/admin/funnels/groups'),
                api.get('/admin/funnels/events'),
                api.get('/admin/users')
            ]);
            setGroups(Array.isArray(resG.data) ? resG.data : []);
            setEvents(Array.isArray(resE.data) ? resE.data : []);
            setAllUsers(Array.isArray(resU.data) ? resU.data : []);
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
            <p className="text-xs uppercase tracking-widest font-black text-muted">Cargando Eventos y Links...</p>
        </div>
    );

    return (
        <div className="space-y-8 min-h-[400px]">
            {connectionError && (
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-500 shadow-lg" style={{ textAlign: 'left' }}>
                    <AlertCircle className="w-8 h-8 shrink-0" />
                    <div className="space-y-1">
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
                        Nuevo Evento Comercial
                    </Button>
                    <Button variant="primary" size="xs" icon={Plus} onClick={() => {
                        if (groups.length === 0) {
                            alert("Primero debes crear al menos un Grupo.");
                            return;
                        }
                        setEditingEvent(null);
                        setEventForm({ name: '', utm_source: '', duration_minutes: 30, buffer_minutes: 15, group_id: groups[0]?.id || '', min_score: 0, setter_id: '', closer_ids: [] });
                        setShowEventModal(true);
                    }}>
                        Nuevo Link
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
                            <h4 className="text-xl font-bold uppercase italic tracking-tighter">No hay Eventos configurados</h4>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest max-w-xs mx-auto opacity-70">Crea un evento comercial para comenzar a organizar tus links de agenda.</p>
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
                                    <Badge variant="neutral" className="bg-main/50 text-[10px]">{getEventsByGroup(group.id).length} Links</Badge>
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
                                                setEventForm({ name: '', utm_source: '', duration_minutes: 30, buffer_minutes: 15, group_id: group.id, min_score: 0, setter_id: '', closer_ids: [] });
                                                setShowEventModal(true);
                                            }}>Crear Evento en {group.name}</Button>
                                        </div>
                                    ) : (
                                        getEventsByGroup(group.id).map(event => (
                                            <Card key={event.id} variant="surface" className="flex items-center justify-between p-6 group border-white/5 hover:border-primary/20 transition-all bg-surface/30 rounded-[1.5rem] shadow-sm">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black shadow-inner text-xl">
                                                        {event.name ? event.name[0] : 'L'}
                                                    </div>
                                                    <div className="text-left space-y-2">
                                                        <h4 className="font-black text-base tracking-tight text-white/90">{event.name}</h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="px-4 py-1.5 bg-main/60 border border-white/10 rounded-full text-[10px] font-black text-muted-main tracking-widest uppercase">
                                                                /{event.utm_source}
                                                            </div>
                                                            <div className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black text-indigo-400 tracking-widest uppercase">
                                                                {event.duration_minutes} MIN
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Button size="xs" variant="ghost" icon={HelpCircle} onClick={() => openQuestions('event', event.id, event.name)} className="hover:bg-primary/10 hover:text-primary transition-all opacity-60 hover:opacity-100" />
                                                    <Button size="xs" variant="ghost" icon={Edit2} onClick={() => { setEditingEvent(event); setEventForm(event); setShowEventModal(true); }} className="hover:bg-primary/20 hover:text-primary transition-all opacity-60 hover:opacity-100" />
                                                    <Button
                                                        size="xs"
                                                        variant="primary"
                                                        icon={LinkIcon}
                                                        onClick={() => window.open(`/book/${event.utm_source}`, '_blank')}
                                                        className="bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 border-none w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                                                    />
                                                    <Button size="xs" variant="ghost" icon={Trash2} onClick={() => handleDeleteEvent(event.id)} className="hover:text-red-500 hover:bg-red-500/10 opacity-40 hover:opacity-100" />
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
                <GroupModal
                    groupName={groupName}
                    setGroupName={setGroupName}
                    onClose={() => setShowGroupModal(false)}
                    onSave={handleSaveGroup}
                />
            )}

            {showEventModal && (
                <EventModal
                    eventForm={eventForm}
                    setEventForm={setEventForm}
                    groups={groups}
                    allUsers={allUsers}
                    onClose={() => setShowEventModal(false)}
                    onSave={handleSaveEvent}
                />
            )}

            {showQuestionsModal && (
                <QuestionsModal
                    editingEvent={editingEvent}
                    activeScope={activeScope}
                    activeEventQuestions={activeEventQuestions}
                    onClose={() => setShowQuestionsModal(false)}
                    editingQuestionId={editingQuestionId}
                    setEditingQuestionId={setEditingQuestionId}
                    questionForm={questionForm}
                    setQuestionForm={setQuestionForm}
                    optionInput={optionInput}
                    setOptionInput={setOptionInput}
                    handleSaveQuestion={handleSaveQuestion}
                    handleDeleteQuestion={handleDeleteQuestion}
                />
            )}
        </div>
    );
};

export default FunnelsManager;
