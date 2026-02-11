import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Kanban, Plus, Save, Trash2, GripVertical, Check, X, Loader2, ListOrdered } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

const SetterMetricManager = () => {
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
            const res = await api.get('/admin/pipelines/setter');
            setPipeline(res.data);
            setError(null);
        } catch (err) {
            setError("Error al cargar las métricas del Setter");
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
            const nextStages = [...pipeline.stages];
            nextStages.splice(index, 1);
            setPipeline({ ...pipeline, stages: nextStages });
            return;
        }

        if (!confirm("¿Eliminar esta métrica? Los reportes asociados podrían perder contexto.")) return;

        try {
            await api.delete(`/admin/pipelines/stages/${id}`);
            fetchPipeline();
        } catch (err) {
            alert("Error al eliminar la métrica");
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/admin/pipelines/setter/stages', {
                pipeline_id: pipeline.id,
                stages: pipeline.stages
            });
            fetchPipeline();
            alert("Cambios guardados"); // Feedback explicit for admin
        } catch (err) {
            alert("Error al guardar los cambios");
        } finally {
            setSaving(false);
        }
    };

    const moveStage = (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === pipeline.stages.length - 1) return;

        const newStages = [...pipeline.stages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];

        // Reassign order
        newStages.forEach((s, idx) => s.order = idx);

        setPipeline({ ...pipeline, stages: newStages });
    };

    if (loading) return (
        <div className="p-20 text-center animate-pulse">
            <ListOrdered className="mx-auto mb-4 text-primary opacity-20" size={48} />
            <p className="text-xs uppercase tracking-widest font-black text-muted">Cargando Métricas...</p>
        </div>
    );

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center bg-surface p-6 rounded-[2rem] border border-base shadow-lg bg-main/30 backdrop-blur-lg">
                <div className="space-y-1 text-left">
                    <h3 className="text-2xl font-black text-base italic tracking-tighter uppercase">
                        Métricas de Setter
                    </h3>
                    <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Define los KPIs que los setters reportarán diariamente</p>
                </div>
                <Button onClick={handleSave} loading={saving} icon={Save} variant="primary" className="px-6">
                    Guardar Cambios
                </Button>
            </header>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-center font-bold">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {pipeline?.stages.map((stage, index) => (
                    <Card key={stage.id || `new-${index}`} className="p-4 flex items-center justify-between group hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex flex-col gap-1 text-muted/20">
                                <button onClick={() => moveStage(index, 'up')} className="hover:text-primary transition-colors">▲</button>
                                <button onClick={() => moveStage(index, 'down')} className="hover:text-primary transition-colors">▼</button>
                            </div>

                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface border border-base font-black text-muted text-xs">
                                {index + 1}
                            </div>

                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={stage.name}
                                    onChange={(e) => handleUpdateStage(index, 'name', e.target.value)}
                                    placeholder="Nombre de la métrica (Ej. Llamadas, DMs Enviados)"
                                    className="w-full bg-transparent border-none outline-none text-sm font-bold text-white placeholder-muted/50 focus:text-primary transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={stage.is_active}
                                    onChange={(e) => handleUpdateStage(index, 'is_active', e.target.checked)}
                                    className="hidden"
                                />
                                <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${stage.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-surface text-muted border border-base'}`}>
                                    {stage.is_active ? 'Activo' : 'Inactivo'}
                                </div>
                            </label>

                            <button
                                onClick={() => handleDeleteStage(stage.id, index)}
                                className="p-2 text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </Card>
                ))}

                <button
                    onClick={handleAddStage}
                    className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-muted text-xs font-black uppercase tracking-widest hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={16} />
                    Agregar Nueva Métrica
                </button>
            </div>

            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                <p className="text-[10px] text-primary/80 font-medium text-center">
                    ℹ️ Estas métricas aparecerán automáticamente en el reporte diario de los setters en el orden establecido.
                </p>
            </div>
        </div>
    );
};

export default SetterMetricManager;
