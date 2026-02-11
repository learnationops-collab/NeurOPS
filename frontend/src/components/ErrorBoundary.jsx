
import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center gap-2 text-orange-500">
                    <AlertTriangle size={16} />
                    <span className="text-[10px] uppercase font-black tracking-widest">Error al cargar componente</span>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
