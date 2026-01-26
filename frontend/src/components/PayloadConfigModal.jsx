import { useState, useEffect } from 'react';
import { X, Check, Eye, EyeOff, Save, Loader2, ListFilter } from 'lucide-react';
import Button from './ui/Button';

const AVAILABLE_FIELDS = [
    { key: 'cliente', label: 'Nombre Completo del Cliente' },
    { key: 'first_name', label: 'Primer Nombre' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'closer', label: 'Closer Responsable' },
    { key: 'monto', label: 'Monto Total Venta' },
    { key: 'cash_collect', label: 'Cash Collected (Neto)' },
    { key: 'tipo_pago', label: 'Tipo de Pago (Cuota, Full...)' },
    { key: 'metodo_pago', label: 'Método de Pago' },
    { key: 'programa', label: 'Programa Vendido' },
    { key: 'valor_programa', label: 'Valor del Programa' },
    { key: 'comision', label: 'Comisión Calculada' },
    { key: 'fecha', label: 'Fecha y Hora' },
    { key: 'transaction_id', label: 'ID Transacción' }
];

const PayloadConfigModal = ({ isOpen, onClose, onSave, initialConfig = {}, loading }) => {
    const [config, setConfig] = useState({});

    useEffect(() => {
        if (isOpen) {
            // Merge initial config with defaults (all true if empty, else use config)
            const safeConfig = initialConfig || {};
            const isEmpty = Object.keys(safeConfig).length === 0;
            const newConfig = {};
            AVAILABLE_FIELDS.forEach(field => {
                newConfig[field.key] = isEmpty ? true : !!safeConfig[field.key];
            });
            setConfig(newConfig);
        }
    }, [isOpen, initialConfig]);

    const toggleField = (key) => {
        setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = () => {
        onSave(config);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-surface border border-base rounded-[2rem] shadow-2xl relative flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-8 border-b border-base/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-base italic uppercase tracking-tighter flex items-center gap-2">
                            <ListFilter size={20} className="text-primary" /> Configurar Datos
                        </h2>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Selecciona qué información enviar al webhook</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full transition-colors text-muted hover:text-base">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                    {AVAILABLE_FIELDS.map((field) => (
                        <button
                            key={field.key}
                            onClick={() => toggleField(field.key)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${config[field.key]
                                ? 'bg-primary/5 border-primary/30'
                                : 'bg-main border-base opacity-70 hover:opacity-100'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${config[field.key] ? 'bg-primary text-white' : 'bg-base text-muted'
                                    }`}>
                                    <Check size={14} className={`transition-transform duration-300 ${config[field.key] ? 'scale-100' : 'scale-0'}`} />
                                </div>
                                <div className="text-left">
                                    <p className={`text-sm font-bold ${config[field.key] ? 'text-base' : 'text-muted'}`}>{field.label}</p>
                                    <p className="text-[9px] font-mono text-muted uppercase">{field.key}</p>
                                </div>
                            </div>

                            <div className="text-muted">
                                {config[field.key] ? <Eye size={16} /> : <EyeOff size={16} />}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-base/50 bg-main/50 rounded-b-[2rem]">
                    <Button
                        onClick={handleSave}
                        loading={loading}
                        variant="primary"
                        className="w-full py-4 text-xs"
                        icon={Save}
                    >
                        Guardar Configuración
                    </Button>
                </div>

            </div>
        </div>
    );
};

export default PayloadConfigModal;
