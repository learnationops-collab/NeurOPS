import React from 'react';
import Modal from '../ui/Modal';

// Los dos van sobre el cascarón `Modal` (portal a body, cabecera y pie fijos). Se abren desde
// adentro del roadmap del lead, que a su vez puede ser un modal: montados en su lugar quedaban
// atrapados en el `space-y-8` del detalle, con el velo corrido y sin alto máximo.

export const EditLeadModal = ({ show, onClose, editForm, setEditForm, onSubmit }) => {
    if (!show) return null;

    return (
        <Modal
            ancho="md"
            titulo="Editar Ficha Lead"
            subtitulo="Actualizar datos de contacto y vinculación"
            onCerrar={onClose}
            onSubmit={onSubmit}
            cuerpoClassName="space-y-4"
            pie={(
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-950 border border-slate-850 rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-900 transition-colors text-slate-300"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-colors shadow-lg shadow-violet-600/20"
                    >
                        Guardar Cambios
                    </button>
                </>
            )}
        >
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-bold"
                    value={editForm.full_name}
                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                    required
                />
            </div>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                <input
                    type="email"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-bold"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                />
            </div>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
                <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-bold"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                />
            </div>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Instagram (@usuario)</label>
                <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-bold"
                    value={editForm.instagram}
                    onChange={e => setEditForm({ ...editForm, instagram: e.target.value })}
                />
            </div>
        </Modal>
    );
};

export const LinkEventModal = ({ show, onClose, linkForm, setLinkForm, onSubmit, currentInstagram }) => {
    if (!show) return null;

    return (
        <Modal
            ancho="md"
            titulo="Vincular Evento Manual"
            subtitulo="Relacionar eventos que no se conectaron automáticamente"
            onCerrar={onClose}
            onSubmit={onSubmit}
            cuerpoClassName="space-y-4"
            pie={(
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-950 border border-slate-850 rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-900 transition-colors text-slate-300"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-colors shadow-lg shadow-violet-600/20"
                    >
                        Vincular Evento
                    </button>
                </>
            )}
        >
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Evento</label>
                <select
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500 font-bold"
                    value={linkForm.event_type}
                    onChange={e => setLinkForm({ ...linkForm, event_type: e.target.value })}
                >
                    <option value="sale">Venta Declarada (ID)</option>
                    <option value="agenda">Agenda / Call Confirmer (ID)</option>
                </select>
            </div>
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">ID del Evento</label>
                <input
                    type="number"
                    placeholder="Ej. 154"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:border-violet-500 font-bold"
                    value={linkForm.event_id}
                    onChange={e => setLinkForm({ ...linkForm, event_id: e.target.value })}
                    required
                />
            </div>

            <p className="text-[9px] text-slate-400 font-bold bg-slate-950/40 p-3 rounded-lg border border-slate-850">
                ℹ️ Esto asociará el evento ID ingresado actualizando su Instagram al valor @{currentInstagram || 'desconocido'}. De esta forma se mostrará automáticamente en este Roadmap.
            </p>
        </Modal>
    );
};
