import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, ArrowLeft, DollarSign, Radio, Users, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdsTab from './AdsTab';
import PeriodSpendTab from './PeriodSpendTab';
import WebhookMonitorTab from './WebhookMonitorTab';
import AdDashboardTab from './AdDashboardTab';

const AdManagementPage = () => {
    const [activeTab, setActiveTab] = useState('ads');
    const [campaigns, setCampaigns] = useState([]);
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [campRes, adsRes] = await Promise.all([
                api.get('/public/campaigns'),
                api.get('/public/ads')
            ]);
            setCampaigns(campRes.data);
            setAds(adsRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { key: 'ads', label: 'Estructura', icon: Layers },
        { key: 'spend', label: 'Inversión', icon: DollarSign },
        { key: 'ads_dashboard', label: 'Rend. por Anuncio', icon: Users },
        { key: 'webhooks', label: 'Webhooks', icon: Radio },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center p-4 py-12 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-900/15 to-transparent pointer-events-none" />

            <div className="w-full max-w-[98%] z-10 space-y-6">
                {/* Tabs Selector */}
                <div className="flex flex-wrap gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-2xl">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 min-w-[180px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all
                                    ${isActive
                                        ? 'bg-slate-800 text-white shadow-lg border border-slate-700/50'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Contenido de la pestaña activa */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-4 md:p-8 shadow-2xl overflow-hidden ring-1 ring-white/5">
                    {activeTab === 'ads' ? (
                        <AdsTab campaigns={campaigns} ads={ads} onRefresh={fetchAll} loading={loading} />
                    ) : activeTab === 'spend' ? (
                        <PeriodSpendTab campaigns={campaigns} ads={ads} onRefresh={fetchAll} />
                    ) : activeTab === 'ads_dashboard' ? (
                        <AdDashboardTab />
                    ) : (
                        <WebhookMonitorTab />
                    )}
                </div>

                {/* Footer Link */}
                <div className="text-center pt-4">
                    <Link to="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 font-medium text-sm transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inicio de Sesión
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdManagementPage;
