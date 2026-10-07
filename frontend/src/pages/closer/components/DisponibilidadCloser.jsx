// La disponibilidad del closer: sus franjas de cada día y su zona horaria. Es el horario de su persona de
// Team en Agendamiento (el mismo que edita la dirección comercial): de ahí salen los horarios que el
// sistema de agendas ofrece a los leads. La zona se adivina por el país de su WhatsApp mientras no elija
// una (app/api/auth.py, /auth/me/disponibilidad).
// Se edita con el mismo editor que Team en Thalamus (HorarioEditor): atajo L a V 9–18, varias franjas por
// día, copiar a otros días y la línea del día. Los cambios se guardan con el botón.

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import api from '../../../services/api';
import Button from '../../../components/ui/Button';
import { HorarioEditor } from '../../agendas_v2/secciones/team/Horario';
import '../../agendas_v2/thalamus.css';

// El editor de Thalamus sigue el modo claro u oscuro de la app.
const temaApp = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

export default function DisponibilidadCloser() {
    const [datos, setDatos] = useState(null); // { horario, tz, zonas, horas, en_team }
    const [horario, setHorario] = useState({});
    const [tz, setTz] = useState('');
    const [cambios, setCambios] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);

    const aplicar = (r) => {
        setDatos(r);
        setHorario(r.horario || {});
        setTz(r.tz);
        setCambios(false);
    };
    useEffect(() => {
        api.get('/auth/me/disponibilidad').then((r) => aplicar(r.data)).catch(() => setError('No se pudo leer tu disponibilidad.'));
    }, []);

    const editar = (campos) => {
        if (campos.horario) setHorario(campos.horario);
        if (campos.tz) setTz(campos.tz);
        setCambios(true);
        setAviso(null);
    };
    const guardar = async () => {
        setOcupado(true); setError(null);
        try {
            const r = await api.put('/auth/me/disponibilidad', { horario, tz });
            aplicar(r.data);
            setAviso('Listo: tu disponibilidad quedó guardada.');
        } catch (e) {
            setError(e?.response?.data?.message || 'No se pudo guardar. Probá de nuevo.');
        } finally { setOcupado(false); }
    };

    if (!datos && !error) return <div className="p-6 text-sm text-slate-400 animate-pulse">Cargando tu disponibilidad…</div>;
    if (!datos) return <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>;

    return (
        <div className="bg-surface p-6 rounded-[2rem] border border-base space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center"><CalendarClock size={20} /></div>
                <div>
                    <h3 className="text-base font-black">Disponibilidad</h3>
                    <p className="text-xs text-muted">Los horarios en los que el sistema te ofrece a los leads. La dirección comercial también puede ajustarlos.</p>
                </div>
            </div>

            <div className="thalamus disp-closer" data-theme={temaApp()}>
                <HorarioEditor p={{ id: 'yo', horario, tz }} onGuardar={editar} />
            </div>

            {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
            {aviso && <p role="status" className="text-xs font-bold text-emerald-400">{aviso}</p>}
            <div className="flex justify-end">
                <Button variant="primary" onClick={guardar} disabled={ocupado || !cambios}>{ocupado ? 'Guardando…' : 'Guardar disponibilidad'}</Button>
            </div>
        </div>
    );
}
