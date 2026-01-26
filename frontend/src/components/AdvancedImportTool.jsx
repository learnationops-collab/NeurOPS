import { useState, useEffect } from 'react';
import {
    FileUp,
    Table as TableIcon,
    Link as LinkIcon,
    AlertCircle,
    Settings,
    CheckCircle2,
    ArrowRight,
    Database,
    ChevronRight,
    Search,
    UserPlus,
    Plus
} from 'lucide-react';
import api from '../services/api';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';

const AdvancedImportTool = () => {
    const [step, setStep] = useState(1);
    const [target, setTarget] = useState('leads');
    const [file, setFile] = useState(null);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [mapping, setMapping] = useState({});
    const [config, setConfig] = useState(null);
    const [options, setOptions] = useState({
        dry_run: false,
        update_existing: true,
        skip_errors: false
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Conflict Resolution State
    const [unresolved, setUnresolved] = useState(null);
    const [missingRequired, setMissingRequired] = useState([]);
    const [missingCounts, setMissingCounts] = useState({});
    const [resolutions, setResolutions] = useState({});
    const [defaults, setDefaults] = useState({});
    const [systemUsers, setSystemUsers] = useState([]);
    const [systemPrograms, setSystemPrograms] = useState([]);
    const [systemPaymentMethods, setSystemPaymentMethods] = useState([]);

    useEffect(() => {
        api.get('/admin/import/config').then(res => setConfig(res.data));
        api.get('/admin/users').then(res => setSystemUsers(res.data));
        api.get('/admin/db/programs').then(res => setSystemPrograms(res.data.data || res.data));
        api.get('/admin/db/payment-methods').then(res => setSystemPaymentMethods(res.data));
    }, []);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            if (lines.length === 0) return;

            const firstLine = lines[0];
            const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            setCsvHeaders(headers);

            // Auto-mapping logic
            const newMapping = {};
            const targetFields = config[target].fields;
            targetFields.forEach(field => {
                const match = headers.find(h =>
                    h.toLowerCase() === field.name.toLowerCase() ||
                    h.toLowerCase() === field.label.toLowerCase() ||
                    h.toLowerCase() === field.label.toLowerCase().replace('usuario del ', '')
                );
                if (match) newMapping[field.name] = match;
            });
            setMapping(newMapping);
            setStep(3);
        };
        reader.readAsText(selectedFile);
    };

    const handleValidate = async () => {
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('target', target);
        formData.append('mapping', JSON.stringify(mapping));

        try {
            const res = await api.post('/admin/import/validate', formData);
            setMissingCounts(res.data.missing_counts || {});
            setMissingRequired(res.data.missing_required || []);

            const hasUnresolved = res.data.unresolved && Object.keys(res.data.unresolved).length > 0;
            const hasMissingReq = res.data.missing_required && res.data.missing_required.length > 0;

            if (hasUnresolved || hasMissingReq) {
                setUnresolved(res.data.unresolved);
                setStep(4);
            } else {
                setStep(5);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Error en la validación');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('target', target);
        formData.append('mapping', JSON.stringify(mapping));
        formData.append('options', JSON.stringify({
            ...options,
            resolutions: resolutions,
            defaults: defaults
        }));

        try {
            const res = await api.post('/admin/import/execute', formData);
            setResult(res.data);
            setStep(6);
        } catch (err) {
            alert(err.response?.data?.message || 'Error en la importación');
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                        <Card
                            variant="surface"
                            className={`p-10 cursor-pointer border-2 transition-all group ${target === 'leads' ? 'border-primary bg-primary/5' : 'border-base hover:border-primary/30'}`}
                            onClick={() => { setTarget('leads'); setStep(2); }}
                        >
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all ${target === 'leads' ? 'bg-primary text-white' : 'bg-surface text-muted group-hover:text-primary'}`}>
                                    <Database size={40} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Leads & Clientes</h3>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-2 leading-relaxed">Importa prospectos masivamente con detección de duplicados</p>
                                </div>
                            </div>
                        </Card>
                        <Card
                            variant="surface"
                            className={`p-10 cursor-pointer border-2 transition-all group ${target === 'sales' ? 'border-primary bg-primary/5' : 'border-base hover:border-primary/30'}`}
                            onClick={() => { setTarget('sales'); setStep(2); }}
                        >
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all ${target === 'sales' ? 'bg-primary text-white' : 'bg-surface text-muted group-hover:text-primary'}`}>
                                    <CheckCircle2 size={40} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Ventas (Enrollments)</h3>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-2 leading-relaxed">Carga cierres y pagos vinculados a programas y closers</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            case 2:
                return (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <Card variant="surface" className="p-12 border-dashed border-2 border-primary/30 bg-primary/5">
                            <div className="flex flex-col items-center text-center space-y-8">
                                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white shadow-2xl shadow-primary/20">
                                    <FileUp size={48} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black italic tracking-tighter uppercase">Selecciona tu archivo CSV</h3>
                                    <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Asegúrate de que la primera fila contenga los encabezados</p>
                                </div>
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    id="csv-upload"
                                    onChange={handleFileChange}
                                />
                                <Button
                                    as="label"
                                    htmlFor="csv-upload"
                                    variant="primary"
                                    className="px-10 h-14 cursor-pointer"
                                    icon={Search}
                                >
                                    Explorar Archivos
                                </Button>
                            </div>
                        </Card>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center bg-surface p-6 rounded-[2rem] border border-base">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black italic tracking-tighter uppercase leading-none">Mapeo de Campos</h3>
                                <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Vincula las columnas de tu CSV con el sistema</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setStep(2)}>Atrás</Button>
                                <Button variant="primary" onClick={handleValidate} loading={loading} icon={ArrowRight}>Validar Datos</Button>
                            </div>
                        </div>

                        <div className="bg-surface rounded-[2rem] border border-base overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-surface-hover/50 border-b border-base">
                                        <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest">Campo del Sistema</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-center">Requerido</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest">Columna en CSV</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest">Análisis Mental</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base">
                                    {config[target].fields.map(field => (
                                        <tr key={field.name} className="hover:bg-surface-hover/30 transition-all">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                        <TableIcon size={14} />
                                                    </div>
                                                    <span className="text-xs font-black text-base">{field.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                {field.required ? (
                                                    <Badge variant="accent" className="px-2 py-0.5">SÍ</Badge>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-muted uppercase">Opcional</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                <select
                                                    className="w-full bg-main border border-base rounded-xl px-4 py-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                                    value={mapping[field.name] || ''}
                                                    onChange={(e) => setMapping({ ...mapping, [field.name]: e.target.value })}
                                                >
                                                    <option value="">-- No importar --</option>
                                                    {csvHeaders.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-8 py-5">
                                                {mapping[field.name] ? (
                                                    <div className="flex items-center gap-2 text-success">
                                                        <CheckCircle2 size={12} />
                                                        <span className="text-[10px] font-bold uppercase italic">Mapeado con éxito</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-muted">
                                                        <AlertCircle size={12} />
                                                        <span className="text-[10px] font-bold uppercase italic">Sin asignar</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center bg-surface p-6 rounded-[2rem] border border-base">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black italic tracking-tighter uppercase leading-none">Resolución de Entidades</h3>
                                <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Mapea valores desconocidos a registros existentes</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setStep(3)}>Atrás</Button>
                                <Button
                                    variant="primary"
                                    onClick={() => setStep(5)}
                                    icon={ArrowRight}
                                    disabled={missingRequired.some(f => !defaults[f] || defaults[f].trim() === '')}
                                >
                                    Continuar
                                </Button>
                            </div>
                        </div>

                        {unresolved && Object.entries(unresolved).map(([field, values]) => (
                            <div key={field} className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
                                        <AlertCircle size={16} />
                                    </div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-base leading-none">
                                        Valores desconocidos en: {
                                            field === 'closer_username' ? 'Closer' :
                                                field === 'program_name' ? 'Programa' :
                                                    field === 'payment_method_name' ? 'Método de Pago' : field
                                        }
                                    </h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {values.map(val => (
                                        <Card key={val} variant="surface" className="p-6 border-accent/20">
                                            <p className="text-sm font-black italic mb-4 truncate text-accent">"{val}"</p>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <LinkIcon size={12} className="text-muted" />
                                                    <span className="text-[9px] font-black uppercase text-muted">Asignar a:</span>
                                                </div>
                                                <select
                                                    className="w-full bg-main border border-base rounded-xl px-4 py-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary"
                                                    value={resolutions[field]?.[val] || ''}
                                                    onChange={(e) => {
                                                        const newResolutions = { ...resolutions };
                                                        if (!newResolutions[field]) newResolutions[field] = {};
                                                        newResolutions[field][val] = e.target.value;
                                                        setResolutions(newResolutions);
                                                    }}
                                                >
                                                    <option value="">-- Ignorar / Error --</option>
                                                    {field === 'closer_username' && (
                                                        <>
                                                            <option value="__CREATE__" className="text-primary font-black">✨ Crear como nuevo usuario</option>
                                                            {systemUsers.map(u => (
                                                                <option key={u.username} value={u.username}>{u.username} ({u.role})</option>
                                                            ))}
                                                        </>
                                                    )}
                                                    {field === 'program_name' && (
                                                        <>
                                                            <option value="__CREATE__" className="text-primary font-black">✨ Crear como nuevo programa</option>
                                                            {systemPrograms.map(p => (
                                                                <option key={p.id} value={p.name}>{p.name}</option>
                                                            ))}
                                                        </>
                                                    )}
                                                    {field === 'payment_method_name' && (
                                                        <>
                                                            <option value="__CREATE__" className="text-primary font-black">✨ Crear como nuevo método</option>
                                                            {systemPaymentMethods.map(m => (
                                                                <option key={m.id} value={m.name}>{m.name}</option>
                                                            ))}
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {missingRequired && missingRequired.length > 0 && (
                            <div className="space-y-6 mt-12 pt-12 border-t border-base">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                        <Database size={16} />
                                    </div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-base leading-none">
                                        Campos Obligatorios sin Datos
                                    </h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {missingRequired.map(field => {
                                        const fieldMeta = config[target].fields.find(f => f.name === field);
                                        return (
                                            <Card key={field} variant="surface" className="p-6 border-primary/20 bg-primary/5">
                                                <div className="flex justify-between items-start mb-4">
                                                    <p className="text-sm font-black italic text-primary">{fieldMeta?.label || field}</p>
                                                    <span className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black uppercase rounded-full">
                                                        {missingCounts[field]} filas vacías
                                                    </span>
                                                </div>
                                                <p className="text-[10px] font-bold text-muted uppercase mb-4 leading-tight">
                                                    Este campo es obligatorio. Por favor asigna un valor por defecto para todas las filas vacías.
                                                </p>
                                                <input
                                                    type="text"
                                                    placeholder="Valor por defecto..."
                                                    className="w-full bg-main border border-base rounded-xl px-4 py-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary"
                                                    value={defaults[field] || ''}
                                                    onChange={(e) => setDefaults({ ...defaults, [field]: e.target.value })}
                                                />
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 5:
                return (
                    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        <Card variant="surface" className="p-10">
                            <div className="flex items-center gap-4 mb-10 pb-6 border-b border-base">
                                <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                                    <Settings size={28} />
                                </div>
                                <h3 className="text-2xl font-black italic tracking-tighter uppercase">Configuración Final</h3>
                            </div>

                            <div className="space-y-8">
                                <div className="flex items-center justify-between group">
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-base uppercase italic">Simulación (Dry Run)</p>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Valida todo sin guardar cambios</p>
                                    </div>
                                    <div
                                        onClick={() => setOptions({ ...options, dry_run: !options.dry_run })}
                                        className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all ${options.dry_run ? 'bg-primary' : 'bg-base'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${options.dry_run ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between group">
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-base uppercase italic">Actualizar Existente</p>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Sobrescribe datos si ya existe el registro</p>
                                    </div>
                                    <div
                                        onClick={() => setOptions({ ...options, update_existing: !options.update_existing })}
                                        className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all ${options.update_existing ? 'bg-primary' : 'bg-base'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${options.update_existing ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between group">
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-base uppercase italic">Omitir Errores</p>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Continúa importando si una fila falla</p>
                                    </div>
                                    <div
                                        onClick={() => setOptions({ ...options, skip_errors: !options.skip_errors })}
                                        className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all ${options.skip_errors ? 'bg-primary' : 'bg-base'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${options.skip_errors ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex flex-col gap-4">
                                <Button variant="primary" className="h-16 text-lg" onClick={handleImport} loading={loading} icon={CheckCircle2}>
                                    {options.dry_run ? 'Ejecutar Simulación' : 'Iniciar Importación'}
                                </Button>
                                <Button variant="ghost" onClick={() => setStep(unresolved || missingRequired.length > 0 ? 4 : 3)}>Retroceder</Button>
                            </div>
                        </Card>
                    </div>
                );
            case 6:
                return (
                    <div className="animate-in zoom-in-95 duration-500">
                        <Card variant="surface" className="p-12 text-center space-y-8">
                            <div className="w-24 h-24 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-success/20">
                                <CheckCircle2 size={48} />
                            </div>
                            <div>
                                <h3 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Sincronización Completada</h3>
                                <p className="text-muted text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Los datos han sido procesados en el clúster</p>
                            </div>

                            <div className="grid grid-cols-3 gap-6 max-w-xl mx-auto py-8 border-y border-base">
                                <div className="space-y-1">
                                    <p className="text-3xl font-black italic text-base">+{result.processed}</p>
                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest">Procesados</p>
                                </div>
                                <div className="space-y-1 border-x border-base">
                                    <p className="text-3xl font-black italic text-success">{result.success}</p>
                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest">Exitosos</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-3xl font-black italic text-accent">{result.errors?.length || 0}</p>
                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest">Errores</p>
                                </div>
                            </div>

                            <Button variant="primary" className="px-12 h-14" onClick={() => setStep(1)}>Volver al Inicio</Button>
                        </Card>
                    </div>
                );
            default:
                return null;
        }
    };

    if (!config) return <div className="p-20 text-center animate-pulse text-muted font-black uppercase tracking-widest">Cargando Protocolos...</div>;

    return (
        <div className="space-y-10">
            {/* Horizontal Stepper Component */}
            <div className="flex justify-between max-w-3xl mx-auto relative px-4">
                <div className="absolute top-1/2 left-0 w-full h-px bg-base -z-10" />
                {[1, 2, 3, 4, 5].map(s => (
                    <div
                        key={s}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${step === s ? 'bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20' : step > s ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-base text-muted'}`}
                    >
                        {step > s ? <CheckCircle2 size={16} /> : <span className="text-xs font-black italic">{s}</span>}
                    </div>
                ))}
            </div>

            <div className="min-h-[500px]">
                {renderStep()}
            </div>
        </div>
    );
};

export default AdvancedImportTool;
