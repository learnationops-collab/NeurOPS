import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Pencil, Trash2, MessageSquare, Save, Loader2, AlertCircle, CheckCircle2
} from 'lucide-react';
import api from '../../../services/api';

const CATEGORIES = [
  { value: 'cualificacion', label: 'Cualificación', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  { value: 'dolor', label: 'Dolor', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
  { value: 'seguimiento', label: 'Seguimiento', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  { value: 'opening', label: 'Opening', color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' }
];

const EMPTY_FORM = { message_id: '', title: '', body: '', category: 'cualificacion', is_active: true };

const MessageManagerModal = ({ isOpen, onClose, initialMessageId, initialCategory }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creando nuevo
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      if (initialMessageId) {
        setEditingId(null);
        setForm({
          message_id: initialMessageId,
          title: '',
          body: '',
          category: initialCategory || 'cualificacion',
          is_active: true
        });
        setShowForm(true);
      }
    }
  }, [isOpen, initialMessageId, initialCategory]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await api.get('/conversational/messages');
      setMessages(res.data);
    } catch (err) {
      showToast('error', 'Error al cargar mensajes');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleOpenEdit = (msg) => {
    setEditingId(msg.id);
    setForm({ message_id: msg.message_id, title: msg.title, body: msg.body || '', category: msg.category, is_active: msg.is_active });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.message_id.trim() || !form.title.trim()) {
      showToast('error', 'ID y título son obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/conversational/messages/${editingId}`, form);
        showToast('success', 'Mensaje actualizado');
      } else {
        await api.post('/conversational/messages', form);
        showToast('success', 'Mensaje creado');
      }
      await fetchMessages();
      handleCancel();
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al guardar';
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este mensaje?')) return;
    try {
      const res = await api.delete(`/conversational/messages/${id}`);
      if (res.data?.status === 'deactivated') {
        const force = window.confirm(
          'Este mensaje tiene estadísticas y registros de interacción asociados en el historial.\n\n¿Deseas eliminarlo de todos modos permanentemente junto con todas sus estadísticas en la base de datos?'
        );
        if (force) {
          await api.delete(`/conversational/messages/${id}?force=true`);
          showToast('success', 'Mensaje y estadísticas eliminados por completo');
        } else {
          showToast('success', 'Mensaje desactivado (se conservó el historial)');
        }
      } else {
        showToast('success', 'Mensaje eliminado');
      }
      await fetchMessages();
    } catch {
      showToast('error', 'Error al eliminar');
    }
  };

  const handleClearRecords = async () => {
    if (!window.confirm('¡ATENCIÓN!\n\nEsto eliminará permanentemente TODOS los registros de interacción de ManyChat y reiniciará las estadísticas de conversión a cero en todo el panel.\n\n¿Estás completamente seguro de que deseas continuar?')) return;
    setLoading(true);
    try {
      const res = await api.delete('/conversational/records/clear');
      showToast('success', res.data.message || 'Registros de interacción eliminados correctamente');
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al eliminar registros';
      showToast('error', msg);
    } finally {
      setLoading(false);
      fetchMessages();
    }
  };

  const getCatStyle = (cat) => CATEGORIES.find(c => c.value === cat)?.color || '';
  const getCatLabel = (cat) => CATEGORIES.find(c => c.value === cat)?.label || cat;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="w-full max-w-2xl bg-surface border border-base rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-base bg-surface-hover/30">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary border border-primary/20">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-base">Mensajes Conversacionales</h2>
                <p className="text-[10px] text-muted font-bold uppercase tracking-[0.2em] mt-0.5">Configura los IDs de ManyChat</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-hover text-muted hover:text-base transition-all">
              <X size={18} />
            </button>
          </div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold border ${
                  toast.type === 'success'
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
              >
                {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {toast.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cuerpo principal con scroll unificado y alternación limpia de vistas */}
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            
            {showForm ? (
              /* Formulario de Creación / Edición (Vista Única) */
              <div className="px-8 py-6 space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {editingId ? 'Editar Mensaje' : 'Nuevo Mensaje'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest">ID de ManyChat *</label>
                    <input
                      value={form.message_id}
                      onChange={e => setForm(p => ({ ...p, message_id: e.target.value }))}
                      placeholder="ej: MSG_001"
                      className="w-full bg-surface border border-base rounded-xl px-4 py-2.5 text-xs font-mono text-base focus:outline-none focus:border-primary/50 placeholder:text-muted/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest">Categoría *</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full bg-surface border border-base rounded-xl px-4 py-2.5 text-xs font-bold text-base focus:outline-none focus:border-primary/50"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-muted uppercase tracking-widest">Título *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="ej: Opening de Cualificación"
                    className="w-full bg-surface border border-base rounded-xl px-4 py-2.5 text-xs font-bold text-base focus:outline-none focus:border-primary/50 placeholder:text-muted/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-muted uppercase tracking-widest">Mensaje (texto enviado)</label>
                  <textarea
                    value={form.body}
                    onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                    placeholder="Escribe aquí el texto del mensaje enviado en ManyChat..."
                    rows={4}
                    className="w-full bg-surface border border-base rounded-xl px-4 py-2.5 text-xs text-base resize-none focus:outline-none focus:border-primary/50 placeholder:text-muted/30"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button onClick={handleCancel} className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-muted hover:text-base border border-base rounded-xl transition-all">
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-widest bg-primary text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              /* Listado de Mensajes Configurados (Vista Única) */
              <div className="flex flex-col flex-1">
                <div className="px-8 pt-6 pb-2 flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted">
                    {messages.length} mensaje{messages.length !== 1 ? 's' : ''} configurado{messages.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearRecords}
                      className="flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-all cursor-pointer"
                      title="Reiniciar estadísticas eliminando todos los registros de interacciones"
                    >
                      <Trash2 size={12} /> Limpiar Historial
                    </button>
                    <button
                      onClick={handleOpenCreate}
                      className="flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 transition-all"
                    >
                      <Plus size={12} /> Nuevo Mensaje
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin text-primary" size={28} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center">
                    <MessageSquare className="mx-auto text-muted/20 mb-4" size={40} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted/40">Sin mensajes configurados</p>
                    <p className="text-[9px] text-muted/30 mt-1">Crea tu primer mensaje para comenzar a medir</p>
                  </div>
                ) : (
              <div className="px-8 pb-8 space-y-2 mt-4">
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    layout
                    className="flex items-center gap-4 p-4 bg-surface-hover/30 border border-base/50 rounded-2xl hover:border-primary/20 transition-all group"
                  >
                    <div className="font-mono text-[9px] font-black text-muted/40 w-5 text-center">{msg.id}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-black text-base truncate">{msg.title}</p>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getCatStyle(msg.category)}`}>
                          {getCatLabel(msg.category)}
                        </span>
                        {!msg.is_active && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border text-muted bg-muted/10 border-muted/20">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-muted font-mono">{msg.message_id}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenEdit(msg)} className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-all">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(msg.id)} className="p-2 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-400/10 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MessageManagerModal;
