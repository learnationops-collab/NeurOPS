// El chat de Learnito va siempre con el tema Learnation (como LearnitoModal), en el modo claro u oscuro de cada uno.
import '../../../pages/agendas_v2/thalamus.css';
import { useApariencia } from '../../../context/AparienciaContext';

export default function TemaLearnito({ className = '', children }) {
    const { modo, modoGuardado } = useApariencia();
    const m = modo || modoGuardado || 'oscuro';
    return (
        <div className={`thalamus ${className}`} data-tema="learnation" data-tema-modo={m} data-theme={m === 'claro' ? 'light' : 'dark'}>
            {children}
        </div>
    );
}
