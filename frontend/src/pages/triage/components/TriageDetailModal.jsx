import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Instagram, ExternalLink, Phone, Loader2, CalendarDays, MessageSquare, Send } from 'lucide-react';
import CommentsSection from '../../../components/shared/CommentsSection';

const TriageDetailModal = ({
    selectedLead,
    onClose,
    meetDateInput,
    setMeetDateInput,
    handleUpdateMeetDate,
    updatingDate,
    triageNote,
    setTriageNote,
    handleUpdateStatus,
    processingId,
    rescheduleData,
    setRescheduleData,
    handleConfirmReschedule,
    onSendNoteOnly,
    formatToDatetimeLocal
}) => {
    if (!selectedLead) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden text-left relative flex flex-col max-h-[90vh] text-slate-100 animate-in zoom-in-95 duration-250"
                >
                    {/* Cabecera */}
                    <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <AlertCircle size={20} className="text-violet-400" />
                                {selectedLead.lead || selectedLead.nombre || 'Sin Nombre'}
                            </h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Ficha de Confirmación • ID Agenda: #{selectedLead.id}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer border-none bg-transparent"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Grid principal */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 pr-2">
                        {/* Columna Izquierda: Info y Acciones */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Bloque 1: Info Principal */}
                            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
                                <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                                    Detalles de Contacto
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-1">
                                        <span className="text-[9px] text-slate-500 uppercase font-black block">Instagram</span>
                                        {selectedLead.instagram ? (
                                            <a
                                                href={selectedLead.ig_chat_link || `https://instagram.com/${selectedLead.instagram.replace('@', '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-violet-400 hover:text-violet-300 font-black hover:underline inline-flex items-center gap-1.5"
                                            >
                                                <Instagram size={12} />
                                                @{selectedLead.instagram.replace('@', '')}
                                                <ExternalLink size={10} />
                                            </a>
                                        ) : (
                                            <span className="text-slate-400 font-bold">No asignado</span>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] text-slate-500 uppercase font-black block">WhatsApp / Teléfono</span>
                                        {selectedLead.whatsapp ? (
                                            <a
                                                href={`https://wa.me/${selectedLead.whatsapp.replace(/[^0-9]/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-emerald-400 hover:text-emerald-300 font-black hover:underline inline-flex items-center gap-1.5"
                                            >
                                                <Phone size={12} />
                                                {selectedLead.whatsapp}
                                                <ExternalLink size={10} />
                                            </a>
                                        ) : (
                                            <span className="text-slate-400 font-bold">N/A</span>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] text-slate-500 uppercase font-black block">Closer Asignado</span>
                                        <span className="text-slate-200 font-black">{selectedLead.closer || 'Sin Closer'}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] text-slate-500 uppercase font-black block">Fuente del Lead</span>
                                        <span className="text-slate-200 font-bold">{selectedLead.nombre || 'Sheets'}</span>
                                    </div>
                                    <div className="space-y-1 sm:col-span-2 border-t border-slate-900/60 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <span className="text-[9px] text-slate-500 uppercase font-black block">Fecha del Meet</span>
                                            <span className="text-slate-200 font-bold">
                                                {selectedLead.date || selectedLead.fecha_meet ? (
                                                    new Date(selectedLead.date || selectedLead.fecha_meet).toLocaleString('es-ES', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                ) : (
                                                    'Sin Fecha Programada'
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="datetime-local"
                                                value={meetDateInput}
                                                onChange={(e) => setMeetDateInput(e.target.value)}
                                                className="bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500/50"
                                            />
                                            <button
                                                onClick={handleUpdateMeetDate}
                                                disabled={updatingDate || !meetDateInput}
                                                className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                                            >
                                                {updatingDate ? <Loader2 size={10} className="animate-spin" /> : 'Actualizar'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 2: Notas del Setter */}
                            {selectedLead.setter_notes && (
                                <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-2">
                                    <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                                        Notas de Cualificación (Setter)
                                    </h4>
                                    <p className="text-xs text-slate-300 italic leading-relaxed">
                                        "{selectedLead.setter_notes}"
                                    </p>
                                </div>
                            )}

                            {/* Bloque 3: Respuestas del Formulario */}
                            {selectedLead.survey_answers && selectedLead.survey_answers.length > 0 && (
                                <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-3">
                                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                                        Respuestas de la Encuesta
                                    </h4>
                                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                        {selectedLead.survey_answers.map((ans, index) => (
                                            <div key={index} className="space-y-0.5 border-l-2 border-emerald-500/20 pl-3">
                                                <p className="text-[9px] font-bold text-slate-500 leading-tight">{ans.question}</p>
                                                <p className="text-xs font-black text-slate-200">{ans.answer || 'Sin respuesta'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bloque 4: Modificar Estado (Acciones de Triaje) */}
                            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                                    <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-wider">
                                        Confirmación de Cita
                                    </h4>
                                    <span className="text-[10px] font-black uppercase bg-violet-650/20 text-violet-400 border border-violet-500/25 px-2.5 py-0.5 rounded-lg">
                                        Estado: {selectedLead.estado || 'Pendiente'}
                                    </span>
                                </div>
                                {selectedLead.id < 0 ? (
                                    <div className="py-6 px-6 bg-slate-950/40 rounded-2xl border border-slate-850/50 text-xs font-semibold text-slate-400 text-center italic">
                                        Este lead no posee una cita agendada para hoy. Utiliza la sección de Notas & Comentarios a la derecha para comunicarte.
                                    </div>
                                ) : (
                                    <>
                                        {/* Botonera de acciones rápidas */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <button
                                                onClick={() => handleUpdateStatus(selectedLead.id, 'Contactado')}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Contactado
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedLead.id, 'Confirmado')}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Confirmar Cita
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedLead.id, 'Sin respuesta')}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Sin Respuesta
                                            </button>
                                            <button
                                                onClick={() => setRescheduleData({ apptId: selectedLead.id, date: '', status: 'Reagendada' })}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-violet-650/80 hover:bg-violet-550 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Reagendar
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedLead.id, 'Cancelada')}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-rose-650/90 hover:bg-rose-550 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Cancelar Cita
                                            </button>
                                        </div>

                                        {/* Selector de Reagenda inline */}
                                        {rescheduleData.apptId === selectedLead.id && (
                                            <div className="pt-4 border-t border-slate-900 flex flex-wrap items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
                                                <span className="text-[10px] font-black uppercase text-violet-400 tracking-wider flex items-center gap-1">
                                                    <CalendarDays size={14} className="text-violet-500" />
                                                    Nueva Fecha de Cita:
                                                </span>
                                                <input 
                                                    type="datetime-local" 
                                                    value={rescheduleData.date ? formatToDatetimeLocal(rescheduleData.date) : ''}
                                                    onChange={(e) => setRescheduleData(prev => ({ ...prev, date: e.target.value }))}
                                                    className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50"
                                                />
                                                <button
                                                    onClick={handleConfirmReschedule}
                                                    disabled={processingId === selectedLead.id || !rescheduleData.date}
                                                    className="h-9 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center cursor-pointer"
                                                >
                                                    {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : 'Confirmar Reagenda'}
                                                </button>
                                                <button 
                                                    onClick={() => setRescheduleData({ apptId: null, date: '', status: '' })}
                                                    className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Columna Derecha: Chat compartido */}
                        <div className="lg:col-span-5 h-[65vh]">
                            {selectedLead.client_id ? (
                                <CommentsSection clientId={selectedLead.client_id} />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-950/20 border border-slate-900 rounded-3xl">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-600 mb-3">
                                        <MessageSquare size={20} />
                                    </div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Chat No Disponible</h4>
                                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wide mt-1.5 max-w-xs leading-relaxed">
                                        Este prospecto no tiene un cliente registrado en el CRM. Para chatear, debe tener una cuenta vinculada.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default TriageDetailModal;
