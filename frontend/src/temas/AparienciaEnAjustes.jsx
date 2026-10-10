// La Apariencia (tema y modo) dentro de las pantallas de ajustes viejas (admin y closer). Va envuelta
// en `.thalamus` porque la pestaña usa sus piezas (panel, rótulos, control segmentado).

import { dataThemeDe, puedeElegirTema, useApariencia } from '../context/AparienciaContext';
import { useAuth } from '../contexts/AuthContext';
import TabApariencia from './TabApariencia';
import '../pages/agendas_v2/thalamus.css';

const modoDeLaApp = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

export default function AparienciaEnAjustes() {
    const { user } = useAuth();
    const apariencia = useApariencia();
    if (!puedeElegirTema(user?.role)) {
        return <p className="text-sm text-muted">El tema de tu rol todavía no se puede cambiar.</p>;
    }
    return (
        <div className="thalamus cu-hoja" data-theme={dataThemeDe(apariencia, modoDeLaApp())}>
            <TabApariencia />
        </div>
    );
}
