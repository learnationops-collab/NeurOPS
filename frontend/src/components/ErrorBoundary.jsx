
import React from 'react';
import { AlertTriangle, Bug } from 'lucide-react';
import { triggerBugReport } from '../utils/bugReportBus';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReport = () => {
        triggerBugReport({
            message: this.state.error?.message || 'Error de renderizado',
            stack: this.state.errorInfo?.componentStack,
            autoOpen: true,
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex flex-col items-center justify-center gap-2 text-orange-500">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span className="text-[10px] uppercase font-black tracking-widest">Error al cargar componente</span>
                    </div>
                    <button
                        onClick={this.handleReport}
                        className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg px-3 py-1.5 transition-all active:scale-95"
                    >
                        <Bug size={12} /> Reportar error
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
