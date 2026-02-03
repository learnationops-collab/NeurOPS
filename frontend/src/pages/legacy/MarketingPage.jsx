import React from 'react';
import Card from '../../components/ui/Card';
import { Zap } from 'lucide-react';

const MarketingPage = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="space-y-1">
                <h1 className="text-4xl font-black text-white italic tracking-tighter">Marketing</h1>
                <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Gestión de Campañas y Leads</p>
            </header>

            <Card variant="surface" className="p-20 flex flex-col items-center justify-center text-center gap-6 rounded-[2.5rem]">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center animate-pulse">
                    <Zap size={40} />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-base italic tracking-tighter uppercase">Próximamente</h2>
                    <p className="text-muted text-sm font-bold uppercase tracking-widest max-w-md">
                        Estamos diseñando las herramientas de análisis de marketing para potenciar tu captación de leads.
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default MarketingPage;
