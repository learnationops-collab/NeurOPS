import { useState, useEffect } from 'react';
import { GraduationCap, Plus, Pencil, Trash2, RefreshCw, AlertCircle, Users, CheckCircle2, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../ui/Card';
import TrainingVideoFormModal, { ROLE_OPTIONS } from './TrainingVideoFormModal';

const roleLabel = (role) => ROLE_OPTIONS.find(r => r.value === role)?.label || role;

const TrainingVideosPanel = () => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formState, setFormState] = useState(null); // null | 'new' | video object (edit)

    const fetchVideos = () => {
        setLoading(true);
        api.get('/training-videos')
            .then(res => setVideos(res.data))
            .catch(() => toast.error('No se pudieron cargar los videos'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchVideos(); }, []);

    const handleEdit = async (video) => {
        try {
            const res = await api.get(`/training-videos/${video.id}`);
            setFormState(res.data);
        } catch {
            toast.error('No se pudo cargar el video para editar');
        }
    };

    const handleDelete = async (video) => {
        if (!window.confirm(`¿Eliminar "${video.title}"? Se perderá el registro de quién ya lo completó.`)) return;
        try {
            await api.delete(`/training-videos/${video.id}`);
            toast.success('Video eliminado');
            fetchVideos();
        } catch {
            toast.error('No se pudo eliminar el video');
        }
    };

    const handleToggleActive = async (video) => {
        try {
            await api.put(`/training-videos/${video.id}`, {
                title: video.title,
                description: video.description,
                loom_link: video.loom_link,
                target_roles: video.target_roles,
                is_active: !video.is_active,
            });
            fetchVideos();
        } catch {
            toast.error('No se pudo cambiar el estado');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
                        <GraduationCap size={22} /> Videos de Documentación
                    </h2>
                    <p className="text-xs text-muted uppercase tracking-widest font-medium">
                        Los usuarios deben verlos y responder el quiz para que dejen de aparecerles
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchVideos}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-black tracking-wider uppercase text-white transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refrescar
                    </button>
                    <button
                        onClick={() => setFormState('new')}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-white text-xs font-black tracking-wider uppercase shadow-lg shadow-primary/20 transition-all active:scale-95"
                    >
                        <Plus size={14} /> Nuevo video
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <RefreshCw className="animate-spin text-indigo-500" size={32} />
                    <span className="text-xs font-black uppercase tracking-widest text-muted">Cargando videos...</span>
                </div>
            ) : videos.length === 0 ? (
                <Card variant="surface" className="p-12 flex flex-col items-center justify-center text-center space-y-4 bg-surface/20 border-dashed border-white/5">
                    <AlertCircle className="text-muted" size={40} />
                    <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-wider text-white">Sin videos todavía</h4>
                        <p className="text-xs text-muted max-w-sm">Pega un link de Loom y arma un par de preguntas para que los usuarios confirmen que lo vieron.</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {videos.map(v => (
                        <Card key={v.id} variant="surface" className="p-5 space-y-3 bg-surface/30 backdrop-blur-md border-white/5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-black text-white truncate">{v.title}</h3>
                                        {!v.is_active && (
                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted bg-white/5 px-2 py-0.5 rounded-lg">
                                                <EyeOff size={10} /> Inactivo
                                            </span>
                                        )}
                                    </div>
                                    {v.description && <p className="text-xs text-muted mt-0.5">{v.description}</p>}
                                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                                        {(v.target_roles.length ? v.target_roles : ['todos']).map(r => (
                                            <span key={r} className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                                                {r === 'todos' ? 'Todos los roles' : roleLabel(r)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => handleEdit(v)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-all" title="Editar">
                                        <Pencil size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(v)} className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all" title="Eliminar">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[10px] font-black uppercase tracking-widest text-muted">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> {v.question_count} pregunta(s)</span>
                                    <span className="flex items-center gap-1.5"><Users size={13} /> {v.completions_count} completado(s)</span>
                                </div>
                                <button
                                    onClick={() => handleToggleActive(v)}
                                    className={`px-3 py-1.5 rounded-lg transition-all ${v.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-muted hover:bg-white/5'}`}
                                >
                                    {v.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {formState && (
                <TrainingVideoFormModal
                    video={formState === 'new' ? null : formState}
                    onClose={() => setFormState(null)}
                    onSaved={() => { setFormState(null); fetchVideos(); }}
                />
            )}
        </div>
    );
};

export default TrainingVideosPanel;
