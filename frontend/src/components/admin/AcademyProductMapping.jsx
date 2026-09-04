import { useState, useEffect } from 'react';
import { GraduationCap, Save, Loader2, Check, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import Button from '../ui/Button';

const PROGRAM_CODES = [
    { v: 'AL', label: 'Ace Learner' },
    { v: 'RR', label: 'Residency Roadmap' },
    { v: 'SI', label: 'Specialist Initiative' }
];

// Vincula los 3 programas internos (AL/RR/SI) con el slug de producto real de la Academia
// (academy.thelearnation.com) — sin esto, AcademyAccessService no sabe qué producto asignarle
// a un cliente al darle acceso. Ver docs/integracion_learnation_api.md §5.1.
const AcademyProductMapping = () => {
    const [mapping, setMapping] = useState({});
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        Promise.all([
            api.get('/admin/academy/product-mapping'),
            api.get('/admin/academy/products').catch(() => ({ data: { data: [] } }))
        ])
            .then(([mapRes, prodRes]) => {
                setMapping(mapRes.data?.product_mapping || {});
                setProducts(prodRes.data?.data || []);
            })
            .catch(() => setError('No se pudo cargar el mapeo de productos'))
            .finally(() => setLoading(false));
    }, []);

    const guardar = async () => {
        setSaving(true);
        setMessage(null);
        setError(null);
        try {
            await api.post('/admin/academy/product-mapping', { product_mapping: mapping });
            setMessage('Mapeo guardado correctamente');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al guardar el mapeo');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <GraduationCap className="text-primary" size={24} />
                    <h2 className="text-2xl font-black text-base italic uppercase tracking-tighter">Vinculación con la Academia</h2>
                </div>
                <p className="text-xs text-muted font-bold uppercase tracking-widest">
                    Qué producto de academy.thelearnation.com recibe cada programa al dar de alta a un cliente
                </p>
                {products.length === 0 && (
                    <p className="text-[10px] text-amber-500 font-bold flex items-center gap-1.5">
                        <AlertCircle size={12} /> No se pudo leer el catálogo en vivo de la Academia — se puede escribir el slug a mano igual.
                    </p>
                )}
            </header>

            <div className="bg-surface p-6 rounded-[2rem] border border-base space-y-4">
                {PROGRAM_CODES.map(({ v, label }) => (
                    <div key={v} className="grid grid-cols-[auto_1fr] items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-black text-base">{v}</p>
                            <p className="text-[10px] text-muted uppercase font-bold tracking-widest">{label}</p>
                        </div>
                        {products.length > 0 ? (
                            <select
                                value={mapping[v] || ''}
                                onChange={(e) => setMapping(m => ({ ...m, [v]: e.target.value }))}
                                className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">— Sin vincular —</option>
                                {products.map(p => (
                                    <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                placeholder="slug del producto en la Academia"
                                value={mapping[v] || ''}
                                onChange={(e) => setMapping(m => ({ ...m, [v]: e.target.value }))}
                                className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            />
                        )}
                    </div>
                ))}

                <div className="flex justify-end pt-2">
                    <Button onClick={guardar} loading={saving} icon={Save} variant="primary">
                        Guardar vinculación
                    </Button>
                </div>
            </div>

            {message && (
                <div className="fixed bottom-8 right-8 p-4 bg-success text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
                    <Check size={18} /><span className="text-xs font-bold">{message}</span>
                </div>
            )}
            {error && (
                <div className="fixed bottom-8 right-8 p-4 bg-rose-500 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
                    <AlertCircle size={18} /><span className="text-xs font-bold">{error}</span>
                </div>
            )}
        </div>
    );
};

export default AcademyProductMapping;
