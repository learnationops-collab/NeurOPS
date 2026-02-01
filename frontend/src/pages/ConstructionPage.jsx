import { Construction } from 'lucide-react';

const ConstructionPage = ({ title }) => {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">{title}</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Seccion en desarrollo</p>
                </div>
            </header>

            <div className="flex flex-col items-center justify-center h-[60vh] gap-8 text-muted animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 rounded-3xl bg-surface border border-base flex items-center justify-center shadow-2xl shadow-black/20">
                    <Construction size={48} className="text-primary" />
                </div>
                <div className="text-center space-y-3">
                    <h3 className="text-2xl font-black text-white italic tracking-tight">Próximamente</h3>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 max-w-md mx-auto">
                        Estamos trabajando duro para traerte las mejores herramientas de {title}.
                        Esta funcionalidad estará disponible en futuras actualizaciones.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConstructionPage;
