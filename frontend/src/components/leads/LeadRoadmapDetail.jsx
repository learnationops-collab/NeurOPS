import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Award, Sparkles, MessageCircle, Phone, Calendar, Bot, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { EditLeadModal } from './LeadRoadmapModals';
import { useAuth } from '../../contexts/AuthContext';
import CommentsSection from '../shared/CommentsSection';

import LeadRoadmapHeader from './components/LeadRoadmapHeader';
import LeadRoadmapFunnel from './components/LeadRoadmapFunnel';
import LeadRoadmapFormInfo from './components/LeadRoadmapFormInfo';
import LeadRoadmapCalificacion from './components/LeadRoadmapCalificacion';

const LeadRoadmapDetail = ({ 
    instagram, 
    clientId, 
    email, 
    phone, 
    onBack, 
    onUpdate, 
    availableKeywords = [], 
    userRole, 
    appointmentId, 
    compact = false 
}) => {
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [activeTab, setActiveTab] = useState('formulario'); // 'formulario' | 'calificacion' | 'chat' | 'notas'
    
    // Calificación en caliente
    const [objeciones, setObjeciones] = useState('');
    const [dolores, setDolores] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [savingCalificacion, setSavingCalificacion] = useState(false);

    // Formulario de edición
    const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', instagram: '' });

    useEffect(() => {
        fetchRoadmap();
    }, [instagram, clientId, email, phone]);

    const fetchRoadmap = async () => {
        setLoading(true);
        try {
            const params = {};
            if (clientId) params.client_id = clientId;
            if (instagram) params.instagram = instagram;
            if (email) params.email = email;
            if (phone) params.phone = phone;

            const res = await api.get('/public/lead-roadmap', { params });
            setData(res.data);
            
            if (res.data?.lead) {
                setEditForm({
                    full_name: res.data.lead.full_name || '',
                    email: res.data.lead.email || '',
                    phone: res.data.lead.phone || '',
                    instagram: res.data.lead.instagram || ''
                });
                setObjeciones(res.data.lead.objeciones || '');
                setDolores(res.data.lead.dolores || '');
                setObservaciones(res.data.lead.observaciones || '');
            }
        } catch (err) {
            console.error("Error fetching lead roadmap", err);
            toast.error(err.response?.data?.error || "No se pudo cargar el Roadmap del Lead");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveClient = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...editForm, client_id: data?.lead?.id || null };
            const res = await api.post('/public/lead-roadmap/update-client', payload);
            toast.success(res.data.message || "Cliente guardado con éxito");
            setShowEditModal(false);
            fetchRoadmap();
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Error saving client", err);
            toast.error(err.response?.data?.error || "Error al guardar cliente");
        }
    };

    const handleSaveCalificacion = async () => {
        setSavingCalificacion(true);
        try {
            const payload = {
                client_id: data?.lead?.id || null,
                instagram: data?.lead?.instagram || instagram,
                email: data?.lead?.email || email,
                full_name: data?.lead?.full_name,
                objeciones,
                dolores,
                observaciones
            };
            const res = await api.post('/public/lead-roadmap/update-client', payload);
            toast.success(res.data.message || "Calificación guardada");
            fetchRoadmap();
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Error saving calificacion", err);
            toast.error("Error al guardar la calificación");
        } finally {
            setSavingCalificacion(false);
        }
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-3">
                <Loader2 className="animate-spin text-violet-500" size={28} />
                <span className="text-xs uppercase font-black tracking-widest">Cargando Roadmap del Lead...</span>
            </div>
        );
    }

    if (!data || !data.lead) {
        return (
            <div className="py-16 text-center text-slate-500 space-y-3 bg-slate-950/40 rounded-3xl border border-slate-850">
                <p className="text-xs font-bold uppercase tracking-wider">Lead no encontrado en el sistema</p>
                {onBack && (
                    <button 
                        onClick={onBack}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300"
                    >
                        Volver al listado
                    </button>
                )}
            </div>
        );
    }

    const { lead, stages, activity, sales_summary, programs, survey_answers } = data;

    return (
        <div className={compact ? "space-y-4 text-slate-200 text-left" : "space-y-8 bg-slate-950 text-slate-200 p-6 rounded-[2rem] border border-slate-800 shadow-2xl relative text-left"}>
            
            {/* CABECERA DE METADATOS Y CONTACTO */}
            <LeadRoadmapHeader
                lead={lead}
                data={data}
                compact={compact}
                onBack={onBack}
                onShowEditModal={() => setShowEditModal(true)}
                userRole={userRole}
                appointmentId={appointmentId}
                availableKeywords={availableKeywords}
                fetchRoadmap={fetchRoadmap}
                onUpdate={onUpdate}
            />

            {/* EMBUDO DE 6 ETAPAS */}
            {!compact && <LeadRoadmapFunnel stages={stages} />}

            {/* PESTAÑAS PARA INTERFAZ COMPACTA / MODAL */}
            {compact && (
                <div className="flex border-b border-slate-800/80 mb-2 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('formulario')}
                        className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === 'formulario' ? 'border-violet-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Formulario / Encuesta
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('calificacion')}
                        className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === 'calificacion' ? 'border-violet-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Calificar Lead
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === 'chat' ? 'border-violet-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Chat & Notas
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('notas')}
                        className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === 'notas' ? 'border-violet-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Historial Eventos
                    </button>
                </div>
            )}

            {/* CONTENIDO PRINCIPAL */}
            <div className={compact ? "space-y-4 mb-4" : "grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8"}>
                
                {/* COLUMNA 1: FORMULARIO Y ENCUESTAS */}
                {(!compact || activeTab === 'formulario') && (
                    <div className={compact ? "" : "lg:col-span-6"}>
                        <LeadRoadmapFormInfo 
                            formData={lead.form_data} 
                            surveyAnswers={survey_answers} 
                        />
                    </div>
                )}

                {/* COLUMNA 2: CALIFICACIÓN EN CALIENTE */}
                {(!compact || activeTab === 'calificacion') && (
                    <div className={compact ? "" : "lg:col-span-6"}>
                        <LeadRoadmapCalificacion
                            dolores={dolores}
                            setDolores={setDolores}
                            objeciones={objeciones}
                            setObjeciones={setObjeciones}
                            observaciones={observaciones}
                            setObservaciones={setObservaciones}
                            handleSaveCalificacion={handleSaveCalificacion}
                            savingCalificacion={savingCalificacion}
                            userRole={userRole}
                        />
                    </div>
                )}

                {/* PESTAÑA DE CHAT EN VIVO COMPACTA */}
                {compact && activeTab === 'chat' && (
                    <div className="bg-slate-900/40 p-4 rounded-3xl border border-slate-850 shadow-xl min-h-[400px]">
                        {lead.id ? (
                            <CommentsSection clientId={lead.id} />
                        ) : (
                            <div className="py-12 text-center text-xs text-slate-500 font-bold italic">
                                Sin ID de cliente registrado para iniciar el chat en vivo
                            </div>
                        )}
                    </div>
                )}

                {/* PESTAÑA DE HISTORIAL DE EVENTOS COMPACTA */}
                {compact && activeTab === 'notas' && (
                    <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-850 shadow-xl space-y-4">
                        <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                            <MessageSquare size={14} className="text-violet-400" />
                            Historial de Actividad
                        </h4>
                        <div className="relative border-l-2 border-slate-800 ml-2 pl-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {(activity || []).map((act, i) => (
                                <div key={i} className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 text-xs space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
                                        <span className="uppercase text-violet-300">{act.event}</span>
                                        <span>{formatTime(act.date)}</span>
                                    </div>
                                    <p className="text-slate-200 font-medium">{act.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* SECCIÓN INFERIOR COMPLETA (MODO NO COMPACTO) */}
            {!compact && (
                <>
                    {/* CHAT EN VIVO COMPARTIDO */}
                    <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-850 shadow-xl space-y-4">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/60 pb-3">
                            <MessageSquare size={16} className="text-violet-400" />
                            Chat de Comunicación del Lead
                        </h4>
                        {lead.id ? (
                            <div className="min-h-[350px]">
                                <CommentsSection clientId={lead.id} />
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-950/20 border border-dashed border-slate-850 rounded-2xl">
                                Lead no vinculado a un cliente activo del CRM
                            </div>
                        )}
                    </div>

                    {/* PROGRAMAS Y VENTAS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-white uppercase tracking-wider px-1">Membresías</h4>
                            {programs && programs.length > 0 ? (
                                <div className="space-y-3">
                                    {programs.map((prog, i) => (
                                        <div key={i} className="bg-slate-900/30 px-4 py-3 rounded-2xl space-y-2">
                                            <div className="flex justify-between items-start">
                                                <span className="text-xs font-black text-white italic uppercase tracking-wide flex items-center gap-1.5">
                                                    <Award size={14} className="text-amber-500" />
                                                    {prog.program_name}
                                                </span>
                                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                                    ${prog.total_paid || '0.00'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 px-4 text-slate-500 text-xs font-bold italic border border-dashed border-slate-850 rounded-2xl bg-slate-950/20">
                                    Sin programas
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-white uppercase tracking-wider px-1">Ventas Totales</h4>
                            {sales_summary ? (
                                <div className="bg-slate-900/30 p-5 rounded-2xl space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-2xl font-black text-emerald-400">${sales_summary.monto}</span>
                                        <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{sales_summary.estado}</span>
                                    </div>
                                    <div className="space-y-1.5 text-xs font-bold text-slate-300">
                                        <div className="flex justify-between"><span className="text-slate-500">Producto</span> <span>{sales_summary.producto}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Método</span> <span>{sales_summary.metodo_pago}</span></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-500 text-xs font-bold italic border border-dashed border-slate-850 rounded-2xl">
                                    Sin ventas
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* MODAL DE EDICIÓN DE DATOS DEL CLIENTE */}
            <EditLeadModal 
                show={showEditModal} 
                onClose={() => setShowEditModal(false)} 
                editForm={editForm} 
                setEditForm={setEditForm} 
                onSubmit={handleSaveClient} 
            />
        </div>
    );
};

export default LeadRoadmapDetail;
