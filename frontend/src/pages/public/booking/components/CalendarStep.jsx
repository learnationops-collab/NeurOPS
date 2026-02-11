import React from 'react';
import { Clock, Globe, CheckCircle, CalendarDays, ChevronLeft } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';

const CalendarStep = ({
    eventInfo,
    availableDates,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    groupedAvailability,
    prevStep,
    handleBook,
    booking
}) => {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
            <header className="text-center space-y-4 mb-10">
                <h2 className="text-6xl font-bold text-base italic tracking-tighter leading-none">Reservar</h2>
                <div className="flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 text-primary font-bold text-[10px] tracking-widest bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                        <Clock size={14} />
                        <span>{eventInfo?.duration} minutos</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted font-bold text-[9px] tracking-widest">
                        <Globe size={14} className="text-primary/40" />
                        <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <Card variant="surface" className="md:col-span-3 p-10 shadow-2xl bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] ml-1">Selecciona fecha</h4>
                        <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar">
                            {availableDates.map(dateStr => {
                                const d = new Date(dateStr + "T00:00:00");
                                const isActive = selectedDate === dateStr;
                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => setSelectedDate(dateStr)}
                                        className={`p-5 rounded-2xl border text-left transition-all duration-300 group/date relative overflow-hidden ${isActive
                                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                            : 'bg-white/5 border-white/10 text-muted hover:border-primary/30 hover:bg-white/[0.07]'
                                            }`}
                                    >
                                        <div className="relative z-10">
                                            <p className={`text-[9px] font-bold tracking-widest mb-1 transition-colors ${isActive ? 'text-white/70' : 'text-primary'}`}>
                                                {d.toLocaleDateString('es-ES', { weekday: 'long' })}
                                            </p>
                                            <p className="font-bold italic text-lg tracking-tight">
                                                {d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                            </p>
                                        </div>
                                        {isActive && <div className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center animate-in fade-in zoom-in duration-500">
                                            <CheckCircle size={16} />
                                        </div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Card>

                <Card variant="surface" className="md:col-span-2 p-10 shadow-2xl bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] ml-1">Horarios ({selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString('es-ES', { day: 'numeric' }) : ''})</h4>
                        <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar">
                            {groupedAvailability[selectedDate]?.map(slot => (
                                <button
                                    key={slot.ts}
                                    onClick={() => setSelectedSlot(slot)}
                                    className={`p-4 rounded-xl border text-center text-sm font-black transition-all duration-300 ${selectedSlot?.ts === slot.ts
                                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.05]'
                                        : 'bg-white/5 border-white/10 text-muted hover:border-primary/30 hover:bg-white/[0.07]'
                                        }`}
                                >
                                    {slot.localStart} HS
                                </button>
                            ))}
                            {(!groupedAvailability[selectedDate] || groupedAvailability[selectedDate].length === 0) && (
                                <div className="py-20 text-center space-y-4 opacity-50">
                                    <CalendarDays size={32} className="mx-auto text-muted/30" />
                                    <p className="text-[10px] font-bold tracking-widest text-muted">Sin horarios disponibles</p>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="flex gap-6">
                <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border border-base rounded-2xl hover:border-primary/30" icon={ChevronLeft} type="button" />
                <Button
                    onClick={handleBook}
                    disabled={!selectedSlot || booking}
                    loading={booking}
                    variant="primary"
                    className="flex-1 h-18 text-lg tracking-widest font-bold uppercase italic shadow-[0_20px_40px_-15px_rgba(var(--primary-rgb),0.3)]"
                    type="button"
                >
                    Confirmar sesión
                </Button>
            </div>
        </div>
    );
};

export default CalendarStep;
