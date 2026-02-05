import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Kanban, Plus, Save, Trash2, GripVertical, Check, X, Loader2 } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';

const PipelineStagesManager = () => {
    const [pipeline, setPipeline] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPipeline();
    }, []);

    const fetchPipeline = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/pipelines/closer');
            setPipeline(res.data);
            setError(null);
        } catch (err) {
            setError("Error al cargar las etapas del Kanban");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStage = () => {
        const newStage = {
            id: null,
            name: '',
            order: pipeline.stages.length,
            is_active: true,
            isNew: true
        };
        setPipeline({
            ...pipeline,
            stages: [...pipeline.stages, newStage]
        });
    };

    const handleUpdateStage = (index, field, value) => {
        const nextStages = [...pipeline.stages];
        nextStages[index] = { ...nextStages[index], [field]: value };
        setPipeline({ ...pipeline, stages: nextStages });
    };

    const handleDeleteStage = async (id, index) => {
        if (!id) {
            // Just remove from local state if it's new
            const nextStages = [...pipeline.stages];
            nextStages.splice(index, 1);
            setPipeline({ ...pipeline, stages: nextStages });
            return;
        }

        if (!confirm("¿Eliminar esta etapa? Los prospectos en esta etapa podrían quedar sin clasificación visual.")) return;

        try {
            await api.delete(`/admin/pipelines/stages/${id}`);
            fetchPipeline();
        } catch (err) {
            alert("Error al eliminar la etapa");
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/admin/pipelines/closer/stages', {
                pipeline_id: pipeline.id,
                stages: pipeline.stages
            });
            fetchPipeline();
        } catch (err) {
            alert("Error al guardar los cambios");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="p-20 text-center animate-pulse">
            <Kanban className="mx-auto mb-4 text-primary opacity-20" size={48} />
            <p className="text-xs uppercase tracking-widest font-black text-muted">Cargando Estructura del Kanban...</p>
        </div>
    );

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center bg-surface p-6 rounded-[2rem] border border-base shadow-lg bg-main/30 backdrop-blur-lg">
                <div className="space-y-1 text-left">
                    <h3 className="text-2xl font-black text-base italic tracking-tighter uppercase">
                        Etapas del Kanban
                    </h3>
                    <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Define el flujo de ventas para tus Closers</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" size="xs" icon={Plus} onClick={handleAddStage}>
                        Añadir Etapa
                    </Button>
                    <Button variant="primary" size="xs" icon={saving ? Loader2 : Save} onClick={handleSave} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </div>
            </header>

            <div className="space-y-4">
                {pipeline?.stages.map((stage, index) => (
                    <Card key={stage.id || `new-${index}`} variant="surface" className={`p-4 transition-all border-transparent ${stage.is_active ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                        <div className="flex items-center gap-6">
                            <div className="cursor-grab text-muted/30">
                                <GripVertical size={20} />
                            </div>

                            <div className="w-12 h-12 bg-main rounded-2xl flex items-center justify-center font-black text-primary border border-base shadow-inner">
                                {stage.order + 1}
                            </div>

                            <div className="flex-1">
                                <input
                                    value={stage.name}
                                    onChange={(e) => handleUpdateStage(index, 'name', e.target.value)}
                                    placeholder="Nombre de la etapa (ej: Seguimiento)"
                                    className="w-full bg-transparent border-none outline-none text-base font-black uppercase tracking-tight placeholder:text-muted/30"
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">Venta Activa</span>
                                    <div className={`w-10 h-6 rounded-full transition-all relative ${stage.is_active ? 'bg-primary' : 'bg-base'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${stage.is_active ? 'left-5' : 'left-1'}`} />
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={stage.is_active}
                                        onChange={e => handleUpdateStage(index, 'is_active', e.target.checked)}
                                    />
                                </label>

                                <button
                                    onClick={() => handleDeleteStage(stage.id, index)}
                                    className="p-3 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    </Card>
                ))}

                {pipeline?.stages.length === 0 && (
                    <div className="p-20 text-center border-2 border-dashed border-base rounded-[2.5rem] opacity-30">
                        <p className="text-xs uppercase tracking-[0.2em] font-black">No hay etapas configuradas</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PipelineStagesManager;
