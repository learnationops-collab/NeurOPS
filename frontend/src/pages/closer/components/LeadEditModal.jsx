import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { localInputsToUtcIso, splitLocalDateTime } from '../../../utils/datetime';

/* Corregir los datos del lead sin salir del mazo.
 *
 * Hasta ahora el closer no tenía dónde arreglar un nombre mal escrito, un teléfono con typo o un
 * mail inválido: el endpoint `PATCH /closer/customers/<id>` existía desde siempre pero ningún
 * componente del mazo lo llamaba (solo lo usaba el modal de ventas). Lo único editable era la
 * fecha/hora, y solo desde flujos puntuales como "agendar 2ª llamada".
 *
 * Son dos endpoints porque son dos entidades: los datos de contacto viven en el cliente y la
 * fecha/hora en la cita. Se manda solo lo que cambió, así una edición de teléfono no reescribe
 * el resto de la ficha.
 */

const Field = ({ label, hint, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] text-slate-400 font-bold uppercase block tracking-wide">{label}</label>
        {children}
        {hint && <p className="text-[10px] text-slate-500 leading-snug">{hint}</p>}
    </div>
);

const INPUT = "w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white outline-none focus:border-violet-500 transition-all font-medium";

const LeadEditModal = ({ lead, onClose, onSaved }) => {
    const initialDT = splitLocalDateTime(lead.start_time);
    const [form, setForm] = useState({
        lead_name: lead.lead_name === 'Sin Nombre' ? '' : (lead.lead_name || ''),
        phone: lead.phone || '',
        email: lead.email || '',
        instagram: (lead.instagram || '').replace(/^@/, ''),
        date: initialDT.date,
        time: initialDT.time
    });
    const [saving, setSaving] = useState(false);

    const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

    const handleSave = async () => {
        if (!form.date || !form.time) {
            toast.error('La fecha y la hora de la llamada son obligatorias');
            return;
        }
        // Validación mínima del mail: el backend descarta el valor si no tiene "@", así que sin
        // este aviso el closer creería que guardó un mail que en realidad quedó vacío.
        if (form.email.trim() && !form.email.includes('@')) {
            toast.error('El correo no parece válido — revisá que tenga @');
            return;
        }

        setSaving(true);
        try {
            const clientPatch = {};
            if (form.lead_name.trim() !== (lead.lead_name === 'Sin Nombre' ? '' : (lead.lead_name || ''))) {
                clientPatch.full_name = form.lead_name.trim();
            }
            if (form.phone.trim() !== (lead.phone || '')) clientPatch.phone = form.phone.trim();
            if (form.email.trim() !== (lead.email || '')) clientPatch.email = form.email.trim();
            if (form.instagram.trim() !== (lead.instagram || '').replace(/^@/, '')) {
                clientPatch.instagram = form.instagram.trim();
            }

            const newStart = localInputsToUtcIso(form.date, form.time);
            const dateChanged = form.date !== initialDT.date || form.time !== initialDT.time;

            if (Object.keys(clientPatch).length === 0 && !dateChanged) {
                toast('No cambiaste nada');
                onClose();
                return;
            }

            if (Object.keys(clientPatch).length > 0) {
                if (!lead.client_id) {
                    toast.error('Este lead no tiene un cliente asociado: no se pueden editar sus datos de contacto');
                } else {
                    await api.patch(`/closer/customers/${lead.client_id}`, clientPatch);
                }
            }
            if (dateChanged) {
                await api.patch(`/closer/appointments/${lead.id}`, { start_time: newStart });
            }

            toast.success('Datos del lead actualizados');
            onSaved?.();
            onClose();
        } catch (err) {
            console.error('Error al actualizar el lead', err);
            toast.error(err.response?.data?.error || 'No se pudieron guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[99997] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Editar datos del lead"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[88vh] overflow-y-auto custom-scrollbar"
            >
                <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-800">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white">Corregir datos del lead</h3>
                        <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                            Arreglá acá lo que esté mal cargado. Los datos de contacto se guardan en el cliente y la
                            fecha en la agenda.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer" aria-label="Cerrar">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <Field label="Nombre completo">
                        <input className={INPUT} value={form.lead_name} onChange={set('lead_name')} placeholder="Nombre y apellido" />
                    </Field>
                    <Field label="Teléfono" hint="Con código de país. Es el número que usa el botón de WhatsApp del modal.">
                        <input className={INPUT} value={form.phone} onChange={set('phone')} placeholder="+51 999 999 999" />
                    </Field>
                    <Field label="Correo" hint="Si no tiene @, el sistema lo descarta y lo guarda vacío.">
                        <input className={INPUT} type="email" value={form.email} onChange={set('email')} placeholder="nombre@correo.com" />
                    </Field>
                    <Field label="Instagram" hint="Sin el @ — se guarda normalizado.">
                        <input className={INPUT} value={form.instagram} onChange={set('instagram')} placeholder="usuario" />
                    </Field>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                        <Field label="Fecha de la llamada">
                            <input className={INPUT} type="date" value={form.date} onChange={set('date')} />
                        </Field>
                        <Field label="Hora">
                            <input className={INPUT} type="time" value={form.time} onChange={set('time')} />
                        </Field>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                        La hora es la de tu zona horaria. Cambiarla mueve la agenda: si el lead ya estaba confirmado,
                        avisale del cambio.
                    </p>
                </div>

                <div className="flex items-center justify-end gap-2 p-5 pt-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2"
                    >
                        {saving && <Loader2 size={13} className="animate-spin" />}
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default LeadEditModal;
