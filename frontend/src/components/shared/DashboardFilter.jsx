import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import api from '../services/api';
import Button from './ui/Button';

// Helper for multi-select dropdown or simple list
const MultiSelect = ({ label, options, selected, onChange }) => {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">{label}</label>
            <div className="flex flex-wrap gap-2">
                {options.map(opt => {
                    const isSelected = selected.includes(opt.id);
                    return (
                        <button
                            key={opt.id}
                            onClick={() => {
                                if (isSelected) onChange(selected.filter(id => id !== opt.id));
                                else onChange([...selected, opt.id]);
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${isSelected
                                    ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(157,78,221,0.2)]'
                                    : 'bg-surface border-base text-muted hover:border-white/20 hover:text-white'
                                }`}
                        >
                            {opt.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const DashboardFilter = ({ currentFilters, onApply, onClose }) => {
    const [closers, setClosers] = useState([]);
    const [programs, setPrograms] = useState([]);

    // Local state for filters before applying
    const [selectedClosers, setSelectedClosers] = useState(currentFilters.closer_ids || []);
    const [selectedPrograms, setSelectedPrograms] = useState(currentFilters.program_ids || []);

    // Date Range (Custom)
    const [startDate, setStartDate] = useState(currentFilters.start_date || '');
    const [endDate, setEndDate] = useState(currentFilters.end_date || '');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch closers (users?role=closer)
                // We use existing endpoints. Admin has access.
                const [usersRes, programsRes] = await Promise.all([
                    api.get('/admin/users?role=closer'),
                    api.get('/admin/db/programs')
                ]);

                // Map users to {id, name}
                setClosers(usersRes.data.map(u => ({ id: u.id, name: u.username })));
                // Map programs
                setPrograms(programsRes.data.map(p => ({ id: p.id, name: p.name })));

            } catch (err) {
                console.error("Error loading filter data", err);
            }
        };
        fetchData();
    }, []);

    const handleApply = () => {
        onApply({
            closer_ids: selectedClosers,
            program_ids: selectedPrograms,
            start_date: startDate,
            end_date: endDate,
            // If custom dates are set, force period='custom'? 
            // Or let parent handle logic. Parent usually sets period='custom' if dates provided.
            period: (startDate && endDate) ? 'custom' : currentFilters.period
        });
        onClose();
    };

    const clearFilters = () => {
        setSelectedClosers([]);
        setSelectedPrograms([]);
        setStartDate('');
        setEndDate('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md bg-[#0a0a0c] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden p-6 flex flex-col gap-6" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white tracking-wide">Filtrar Dashboard</h2>
                    <button onClick={onClose} className="text-muted hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-6 overflow-y-auto max-h-[60vh] custom-scrollbar pr-2">

                    {/* Closers */}
                    <MultiSelect
                        label="Closers / Asesores"
                        options={closers}
                        selected={selectedClosers}
                        onChange={setSelectedClosers}
                    />

                    {/* Programs */}
                    <MultiSelect
                        label="Programas"
                        options={programs}
                        selected={selectedPrograms}
                        onChange={setSelectedPrograms}
                    />

                    {/* Date Range */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted">Rango de Fechas Personalizado</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-muted mb-1 block">Desde</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-muted mb-1 block">Hasta</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-base/50">
                    <button
                        onClick={clearFilters}
                        className="text-xs font-medium text-muted hover:text-white transition-colors underline"
                    >
                        Limpiar Filtros
                    </button>
                    <div className="flex gap-3">
                        <div onClick={onClose}>
                            <Button variant="ghost" size="sm" >Cancelar</Button>
                        </div>
                        <div onClick={handleApply}>
                            <Button variant="primary" size="sm" icon={Check}>Aplicar Filtros</Button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DashboardFilter;
