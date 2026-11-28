// «Conectar Instagram» en la cabecera del Inbox (ADR-W286). Lo pide Meta para aprobar Human Agent (los 7 días para
// escribir desde Work) y deja cambiar la cuenta sin tocar Railway. El token se renueva solo cada 7 días; si vence
// pronto o falló la renovación, el botón lo avisa. Solo quien edita el Inbox.
import { useEffect, useState } from 'react';
import { Instagram } from 'lucide-react';
import { Button, toast } from '../../components/standard';
import { inboxApi } from './api';

const DIA = 86400000;
const VUELTA = {
    conectado: ['Instagram conectado: el token se renueva solo', 'success'],
    cancelado: ['No se conectó: cancelaste el permiso en Instagram', 'error'],
    vencido: ['Pasaron más de 15 minutos: volvé a tocar Conectar Instagram', 'error'],
    error: ['Instagram no aceptó la conexión. Revisá que la URL de vuelta esté cargada en la app de Meta.', 'error'],
};

export default function ConexionInstagram() {
    const [estado, setEstado] = useState(null);
    const [yendo, setYendo] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const vuelta = params.get('instagram');
        if (vuelta && VUELTA[vuelta]) {
            toast(...VUELTA[vuelta]);
            params.delete('instagram');
            const resto = params.toString();
            window.history.replaceState(null, '', window.location.pathname + (resto ? `?${resto}` : ''));
        }
        inboxApi.conexionInstagram().then(setEstado).catch(() => setEstado(null));
    }, []);

    if (!estado) return null;
    const conectado = estado.origen === 'conexion';
    const dias = estado.vence_en ? Math.floor((new Date(estado.vence_en) - Date.now()) / DIA) : null;
    const alerta = !conectado || estado.error || (dias !== null && dias < 14);
    const conectar = async () => {
        setYendo(true);
        try {
            const { url } = await inboxApi.conectarInstagram();
            window.location.href = url;
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo abrir Instagram', 'error');
            setYendo(false);
        }
    };
    const tip = conectado
        ? `Instagram${estado.usuario ? ` @${estado.usuario}` : ''}|Se renueva solo cada 7 días${dias !== null ? ` · vence en ${dias} días` : ''}${estado.error ? ` · ${estado.error}` : ''}. Tocalo para reconectar.`
        : `Conectar Instagram|Hoy el Inbox usa el token cargado a mano en Railway${estado.error ? ` (${estado.error})` : ''}. Conectalo para que se renueve solo.`;
    return (
        <Button size="sm" variant={alerta ? 'primary' : undefined} icon={<Instagram />} disabled={yendo} onClick={conectar} data-tip={tip}>
            {conectado ? (estado.usuario ? `@${estado.usuario}` : 'Instagram conectado') : 'Conectar Instagram'}
        </Button>
    );
}
