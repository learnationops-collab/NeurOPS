import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '../../standard';
import { bajarAudio } from './pedidosApi';

// El audio se baja con la sesión (como los del Inbox) recién al tocar «Escuchar».
export default function AudioPedido({ id, cual }) {
    const [url, setUrl] = useState(null);
    const [cargando, setCargando] = useState(false);
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

    if (url) return <audio className="pa-audio" src={url} controls autoPlay />;
    return (
        <Button size="sm" variant="ghost" icon={<Play size={14} />} disabled={cargando}
            onClick={() => { setCargando(true); bajarAudio(id, cual).then((b) => setUrl(URL.createObjectURL(b))).finally(() => setCargando(false)); }}>
            Escuchar audio
        </Button>
    );
}
