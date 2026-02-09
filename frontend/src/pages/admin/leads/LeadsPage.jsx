
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../services/api';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import {
    Search, Filter, Download, User, Phone, Instagram,
    Calendar, MoreHorizontal, MessageSquare
} from 'lucide-react';

const AdminLeadsPage = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        search: '',
        status: 'all'
    });

    useEffect(() => {
        fetchLeads();
    }, [page, filters]);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                search: filters.search,
            });
            const res = await api.get(`/admin/leads?${params}`);
            setLeads(res.data.leads || []);
            setTotalPages(res.data.pages || 1);
        } catch (error) {
            console.error("Error fetching leads", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchLeads();
    };

    return (
        <div className="h-screen overflow-hidden bg-main relative">
            <div className="absolute inset-0 p-8 sm:p-12 overflow-y-auto">
                <div className="max-w-[1600px] mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                                Base de Leads
                            </h1>
                            <p className="text-muted font-medium text-lg italic bg-clip-text text-transparent bg-gradient-to-r from-muted to-muted/50">
                                "Gestión centralizada de prospectos."
                            </p>
                        </div>
                    </div>

                    {/* Controls */}
                    <Card className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-surface/30 backdrop-blur-md border-white/5">
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, email..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" className="gap-2">
                                <Filter size={16} /> Filtros
                            </Button>
                            <Button variant="outline" className="gap-2">
                                <Download size={16} /> Exportar
                            </Button>
                        </div>
                    </Card>

                    {/* Leads Table */}
                    <Card className="overflow-hidden border-white/5 bg-surface/30 backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 bg-black/20">
                                        <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-bold">Cliente</th>
                                        <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-bold">Contacto</th>
                                        <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-bold">Fecha / Origen</th>
                                        <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-bold text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="4" className="p-12 text-center text-muted animate-pulse">
                                                Cargando leads...
                                            </td>
                                        </tr>
                                    ) : leads.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="p-12 text-center text-muted">
                                                No se encontraron leads
                                            </td>
                                        </tr>
                                    ) : (
                                        leads.map((lead) => (
                                            <tr key={lead.id} className="group hover:bg-white/5 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                                            {lead.username?.charAt(0).toUpperCase() || <User size={16} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-sm">{lead.username}</div>
                                                            <div className="text-xs text-muted">{lead.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="space-y-1">
                                                        {lead.phone && (
                                                            <div className="flex items-center gap-2 text-xs text-muted">
                                                                <Phone size={12} /> {lead.phone}
                                                            </div>
                                                        )}
                                                        {lead.instagram && (
                                                            <div className="flex items-center gap-2 text-xs text-muted">
                                                                <Instagram size={12} /> {lead.instagram}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 text-xs text-muted">
                                                            <Calendar size={12} /> {new Date(lead.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Button variant="ghost" size="sm" className="hover:bg-primary/20 hover:text-primary">
                                                        <MoreHorizontal size={16} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="p-4 border-t border-white/5 flex items-center justify-between">
                            <div className="text-xs text-muted">
                                Página {page} de {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </Card>

                </div>
            </div>
        </div>
    );
};

export default AdminLeadsPage;
