import React, { useState } from 'react';
import { CalendarDays, Settings as SettingsIcon } from 'lucide-react';
import FunnelsManager from '../../../components/sales/FunnelsManager';

const SalesAgendasPage = () => {
    return (
        <div className="h-screen overflow-y-auto custom-scrollbar pb-32">
            <div className="flex flex-col items-center justify-start p-12">
                <div className="w-full max-w-7xl space-y-8 py-12 animate-in fade-in duration-700">
                    {/* Header */}
                    <header className="flex justify-between items-end border-b border-base pb-8 mb-4">
                        <div className="space-y-1 text-left">
                            <h1 className="text-5xl font-black text-base italic tracking-tighter uppercase leading-none flex items-center gap-4">
                                <CalendarDays size={40} className="text-primary mb-1" /> Gestión de Agendas
                            </h1>
                            <p className="text-muted font-medium uppercase text-[10px] tracking-[0.2em]">Configuración de embudos, eventos y links comerciales</p>
                        </div>
                    </header>

                    {/* Funnels Manager Component */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                        <FunnelsManager />
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SalesAgendasPage;
