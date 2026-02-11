import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

const GroupModal = ({ groupName, setGroupName, onClose, onSave }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <Card className="w-full max-w-sm space-y-6 shadow-2xl border-white/5 animate-in zoom-in-95 duration-300">
                <header>
                    <h3 className="text-xl font-black uppercase tracking-tight italic">Configurar Grupo</h3>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Categoriza tus embudos de venta</p>
                </header>
                <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Ej: Tráfico Pagado, Orgánico..."
                    className="w-full bg-main border border-base rounded-xl px-4 py-4 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" onClick={onSave} className="px-10">Guardar</Button>
                </div>
            </Card>
        </div>
    );
};

export default GroupModal;
