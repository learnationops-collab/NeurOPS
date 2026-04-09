import React from 'react';
import { X, User, DollarSign, Calendar, MapPin, Tag, Phone, Mail, FileText, CheckCircle2 } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

const FinancialSaleDetailsModal = ({ sale, onClose }) => {
    if (!sale) return null;

    // Helper to extract keys safely from raw_data
    const getRawValue = (key) => sale.raw_data?.[key] || 'No especificado';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <Card variant="surface" className="w-full max-w-2xl p-0 rounded-3xl border-base shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
                    <div>
                        <h3 className="text-xl font-black text-white italic tracking-tighter flex items-center gap-2">
                            <FileText className="text-primary" size={20} />
                            Ficha de Venta 
                            <span className="text-muted text-sm font-medium not-italic ml-2">#{sale.id}</span>
                        </h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/5 transition-colors text-muted hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
                    
                    {/* Status Banner */}
                    {sale.status === 'valid' ? (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-success/10 border border-success/20 text-success">
                            <CheckCircle2 size={24} />
                            <div>
                                <h4 className="font-bold uppercase tracking-widest text-xs">Registro Validado</h4>
                                <p className="text-sm opacity-80 mt-0.5">La venta fue procesada correctamente sin errores de parsing.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                            <X className="mt-0.5" size={20} />
                            <div>
                                <h4 className="font-bold uppercase tracking-widest text-xs">Contiene Errores</h4>
                                <p className="text-sm opacity-90 mt-1">{sale.error_notes}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Datos del Cliente */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-primary/80 uppercase tracking-widest border-b border-primary/20 pb-2">Datos del Cliente</h4>
                            
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-muted"><User size={16} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Nombre Completo</p>
                                        <p className="text-sm font-medium text-white">{sale.cliente}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-muted"><Phone size={16} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Teléfono</p>
                                        <p className="text-sm font-medium text-white">{getRawValue('telefono')}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-muted"><Mail size={16} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Email</p>
                                        <p className="text-sm font-medium text-white break-all">{getRawValue('mail') || getRawValue('email') || 'No especificado'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-muted"><Activity size={16} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Instagram</p>
                                        {sale.instagram && sale.instagram !== 'N/A' ? (
                                            <a 
                                                href={`https://instagram.com/${sale.instagram.replace('@', '')}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-sm font-medium text-primary hover:underline"
                                            >
                                                {sale.instagram.startsWith('@') ? sale.instagram : `@${sale.instagram}`}
                                            </a>
                                        ) : (
                                            <p className="text-sm font-medium text-white">No especificado</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Datos de la Venta */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-primary/80 uppercase tracking-widest border-b border-primary/20 pb-2">Información de Venta</h4>
                            
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-indigo-400"><Tag size={16} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Producto / Tipo</p>
                                        <div className="flex gap-2 mt-1">
                                            <Badge variant="indigo" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider">
                                                {sale.producto}
                                            </Badge>
                                            <Badge variant="surface" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider opacity-80">
                                                {sale.payment_type}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-success"><DollarSign size={16} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Monto Abonado</p>
                                        <p className="text-xl font-black text-success tracking-tighter">${sale.amount.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-muted"><Calendar size={16} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Fecha Original (Google Sheets)</p>
                                        <p className="text-sm font-medium text-white">{getRawValue('fecha') || getRawValue('date') || new Date(sale.date).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Asignaciones */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h4 className="text-[10px] font-black text-primary/80 uppercase tracking-widest border-b border-primary/20 pb-2">Asignaciones Internas</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-center items-center text-center">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Setter Asignado (Columna K)</p>
                                <p className="text-sm font-black text-white">{sale.setter_name}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-center items-center text-center">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Closer Asociado</p>
                                <p className="text-sm font-black text-amber-500">{sale.closer}</p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 flex justify-end bg-black/20">
                    <Button variant="ghost" className="rounded-xl px-6" onClick={onClose}>
                        Cerrar Panel
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default FinancialSaleDetailsModal;
