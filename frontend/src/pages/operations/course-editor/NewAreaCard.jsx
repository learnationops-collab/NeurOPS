import { useState } from 'react';
import { Plus, Check, X, Loader2 } from 'lucide-react';

const NewAreaCard = ({ onCreate }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    const close = () => { setOpen(false); setName(''); };

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim() || saving) return;
        setSaving(true);
        try {
            await onCreate(name.trim());
            close();
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <button type="button" className="new-area-card" onClick={() => setOpen(true)}>
                <Plus size={22} /> Área
            </button>
        );
    }

    return (
        <div className="new-area-card" style={{ cursor: 'default' }}>
            <form className="new-area-form" onSubmit={submit}>
                <input
                    autoFocus
                    className="form-input"
                    placeholder="Nombre del área (ej: Skills)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && close()}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button type="submit" className="icon-btn" disabled={saving} aria-label="Crear área">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button type="button" className="icon-btn" onClick={close} aria-label="Cancelar"><X size={14} /></button>
                </div>
            </form>
        </div>
    );
};

export default NewAreaCard;
