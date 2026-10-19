// Learnito a pantalla completa (/copiloto). Lo habitual es abrirlo en un modal desde el dock; esta
// página queda como acceso directo y muestra la misma conversación (LearnitoContext).
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react';
import '../agendas_v2/thalamus.css';
import { dataThemeDe, useApariencia } from '../../context/AparienciaContext';
import { Button, PageHeader } from '../../components/standard';
import { useLearnito } from '../../sesion/LearnitoContext';
import LearnitoChat from './LearnitoChat';

export default function CopilotoApp() {
    const navigate = useNavigate();
    const apariencia = useApariencia();
    const { mensajes, enviando, reiniciar } = useLearnito();

    useEffect(() => { document.title = 'Learnito · Learnation'; }, []);

    const volver = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

    return (
        <div className="thalamus thalamus-app copiloto" data-theme={dataThemeDe(apariencia, undefined)}>
            <div className="wrap">
                <PageHeader size="sm" title="Learnito" logo={<Sparkles className="cp-logo" size={22} aria-hidden="true" />}
                    actions={(
                        <>
                            {mensajes.length > 0 && (
                                <Button variant="ghost" icon={<RotateCcw size={14} />} onClick={reiniciar} disabled={enviando}>
                                    Nueva conversación
                                </Button>
                            )}
                            <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={volver}>Volver</Button>
                        </>
                    )} />
                <main className="vista">
                    <LearnitoChat />
                </main>
            </div>
        </div>
    );
}
