import React from 'react';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { useTheme } from '../context/ThemeContext';
import { Palette, Layers, Type, MousePointer2 } from 'lucide-react';

const StyleGuidePage = () => {
    const { theme, setTheme, themes } = useTheme();

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
            <header className="flex justify-between items-end border-b border-base pb-8">
                <div>
                    <Badge variant="primary" className="mb-2">Design System v1.0</Badge>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase">Style Guide</h1>
                    <p className="text-muted font-bold uppercase text-[10px] tracking-widest mt-2">Exploración de componentes y temas dinámicos</p>
                </div>

                <div className="flex gap-2 bg-surface p-1.5 rounded-2xl border border-base">
                    {Object.values(themes).map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTheme(t.id)}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${theme === t.id ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}
                        >
                            {t.name}
                        </button>
                    ))}
                </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* BUTTONS */}
                <Card variant="glass" className="space-y-8">
                    <CardHeader className="flex items-center gap-3">
                        <MousePointer2 className="text-primary" />
                        <h3 className="text-lg font-black uppercase italic tracking-tight">Botones & Acciones</h3>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-wrap gap-4">
                            <Button variant="primary">Primary Action</Button>
                            <Button variant="secondary">Success Flow</Button>
                            <Button variant="outline">Secondary</Button>
                            <Button variant="ghost">Minimalist</Button>
                            <Button variant="glass">Glass Effect</Button>
                        </div>
                        <div className="flex flex-wrap gap-4 items-center">
                            <Button size="xs" variant="primary">Small</Button>
                            <Button size="sm" variant="primary">Medium</Button>
                            <Button size="md" variant="primary">Default</Button>
                            <Button size="lg" variant="primary">Large</Button>
                        </div>
                        <div className="flex gap-4">
                            <Button loading variant="primary" className="w-full">Procesando...</Button>
                            <Button disabled variant="outline" className="w-full">Deshabilitado</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* FORMS */}
                <Card variant="surface" className="space-y-8">
                    <CardHeader className="flex items-center gap-3">
                        <Type className="text-primary" />
                        <h3 className="text-lg font-black uppercase italic tracking-tight">Formularios & Tipografía</h3>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Input label="Nombre del Protocolo" placeholder="Ej: Standard Operating Procedure" />
                        <Input label="Email de Acceso" type="email" placeholder="admin@neur-ops.ai" />
                        <Input label="Password" type="password" error="Contraseña demasiado débil" />
                        <div className="pt-4 space-y-2">
                            <p className="text-4xl font-black italic tracking-tighter uppercase">Neur-Ops Intelligence</p>
                            <p className="text-sm text-muted">Building the future of agentic coding and automation.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* CARDS & GLASS */}
                <Card variant="outline" className="md:col-span-2 space-y-8 bg-main/50">
                    <CardHeader className="flex items-center gap-3">
                        <Layers className="text-primary" />
                        <h3 className="text-lg font-black uppercase italic tracking-tight">Contenedores & Transparencia</h3>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card variant="surface" padding="p-6">
                            <Badge variant="neutral" className="mb-4">Standard Surface</Badge>
                            <p className="text-xs text-muted">Contenedor sólido con sombra profunda para jerarquía clara.</p>
                        </Card>
                        <Card variant="glass" padding="p-6">
                            <Badge variant="primary" className="mb-4">Glassmorphism</Badge>
                            <p className="text-xs text-muted">Efecto translúcido con desenfoque de fondo y bordes suaves.</p>
                        </Card>
                        <Card variant="outline" padding="p-6">
                            <Badge variant="accent" className="mb-4">Outline Card</Badge>
                            <p className="text-xs text-muted">Bordes minimalistas para secciones de menor importancia.</p>
                        </Card>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
};

export default StyleGuidePage;
