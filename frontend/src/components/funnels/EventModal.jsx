import React from 'react';
import { Save } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';

const EventModal = ({
    eventForm,
    setEventForm,
    groups,
    allUsers,
    onClose,
    onSave
}) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <Card className="w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl border-white/5 animate-in zoom-in-95 duration-300">
                <header className="border-b border-base pb-6">
                    <h3 className="text-xl font-black uppercase tracking-tight italic">Configuración de Link / Variante</h3>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Define el slug personalizado y configuraciones del link</p>
                </header>
                <div className="grid grid-cols-2 gap-6 text-left">
                    <div className="col-span-2 space-y-3">
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Identificador Interno</label>
                        <input value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} placeholder="Ej: Elias (JC)" className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/50" />
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
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Evento Comercial (Padre)</label>
                        <select value={eventForm.group_id} onChange={e => setEventForm({ ...eventForm, group_id: e.target.value })} className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none cursor-pointer">
                            <option value="">Selecciona el evento comercial...</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>

                    <div className="col-span-2 space-y-3">
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Setter Predeterminado (Atribución)</label>
                        <select
                            value={eventForm.setter_id || ''}
                            onChange={e => setEventForm({ ...eventForm, setter_id: e.target.value })}
                            className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none cursor-pointer"
                        >
                            <option value="">Ninguno (Sin Atribución por Defecto)</option>
                            {allUsers.filter(u => ['admin', 'setter', 'closer'].includes(u.role)).map(u => (
                                <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-2 space-y-3">
                        <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Closers Disponibles (Rotación)</label>
                        <div className="grid grid-cols-2 gap-2 bg-main/50 p-4 rounded-xl border border-base">
                            {allUsers.filter(u => u.role === 'closer').map(u => {
                                const isSelected = eventForm.closer_ids?.includes(u.id);
                                return (
                                    <label key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-surface border-base hover:border-primary/30'}`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isSelected}
                                            onChange={() => {
                                                const next = isSelected
                                                    ? eventForm.closer_ids.filter(id => id !== u.id)
                                                    : [...(eventForm.closer_ids || []), u.id];
                                                setEventForm({ ...eventForm, closer_ids: next });
                                            }}
                                        />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'bg-main border-base'}`}>
                                            {isSelected && <Save size={10} className="text-white" />}
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-tight">{u.username}</span>
                                    </label>
                                );
                            })}
                            {allUsers.filter(u => u.role === 'closer').length === 0 && (
                                <p className="col-span-2 text-[10px] text-muted font-bold uppercase italic text-center py-2">No hay closers registrados.</p>
                            )}
                        </div>
                        <p className="text-[9px] text-muted italic ml-1">* Si no seleccionas ninguno, se mostrará la disponibilidad de TODOS los closers.</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-base">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" onClick={onSave} className="px-10">Guardar Link</Button>
                </div>
            </Card>
        </div>
    );
};

export default EventModal;
