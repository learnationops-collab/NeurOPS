// Notas de Meet (Operaciones › Integraciones): Work lee las notas de Gemini del Drive de team@ y las cuelga de cada agenda.
// La cuenta la conecta quien tenga team@, con un link firmado que se genera acá (app/api/notas_meet.py).

import { useEffect, useState } from 'react';
import api from '../../../../services/api';
import { Icono } from '../../ui/base';
import { Button, FieldError, InputGroup } from '../../../../components/standard';
import { Estado, Mensajes, Tarjeta } from './cuenta';

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'todavía no');

export default function TarjetaNotasMeet() {
    const [st, setSt] = useState(null);
    const [link, setLink] = useState(null);
    const [msg, setMsg] = useState({});
    const [ocupado, setOcupado] = useState(false);

    const leer = () => api.get('/notas-meet/estado').then(r => setSt(r.data)).catch(() => setSt({ conectada: false }));
    useEffect(() => { leer(); }, []);

    const correr = async (fn) => {
        setOcupado(true);
        setMsg({});
        try { await fn(); } catch (e) { setMsg({ error: e.response?.data?.error || 'Algo falló. Probá de nuevo.' }); } finally { setOcupado(false); }
    };
    const generar = () => correr(async () => { setLink((await api.post('/notas-meet/link')).data); });
    const copiar = () => navigator.clipboard?.writeText(link.link).then(() => setMsg({ aviso: 'Link copiado.' }));
    const leerAhora = () => correr(async () => {
        const r = await api.post('/notas-meet/sincronizar');
        setMsg({ aviso: `Listo: ${r.data.guardadas} notas nuevas o actualizadas.` });
        await leer();
    });
    const desconectar = () => correr(async () => {
        await api.post('/notas-meet/desconectar');
        setLink(null);
        await leer();
    });

    const conectada = !!st?.conectada;
    return (
        <Tarjeta icono="video" titulo="Notas de Meet"
            texto="Las notas que Gemini toma en cada sesión quedan en el Drive de team@. Work las lee cada 15 minutos y las muestra en la ficha del lead."
            estado={st && <Estado ok={conectada} si="Conectada" no={st.vencida ? 'Vencida' : 'Sin conectar'} />}>
            {!st ? <p className="t-sm mut">Cargando…</p> : conectada ? (
                <div className="cu-fila">
                    <p className="t-sm" style={{ flex: '1 1 220px' }}>
                        {st.email || 'Cuenta conectada'} · {st.notas} notas ({st.vinculadas} con su agenda) · última lectura: {fecha(st.ultima_lectura)}
                    </p>
                    <Button variant="primary" icon={<Icono n="rotar" />} disabled={ocupado} onClick={leerAhora}>Leer ahora</Button>
                    <Button variant="danger" disabled={ocupado} onClick={desconectar}>Desconectar</Button>
                </div>
            ) : (
                <div className="cu-fila">
                    <p className="t-sm mut" style={{ flex: '1 1 220px' }}>
                        {st.vencida ? 'Google dejó de aceptar la conexión. ' : ''}
                        Generá un link y pasáselo a quien tenga la cuenta team@: lo abre, elige team@ y acepta. Vence en 24 horas.
                    </p>
                    <Button variant="primary" icon={<Icono n="link" />} disabled={ocupado} onClick={generar}>Generar link</Button>
                    {link && (
                        <InputGroup prefix={<Icono n="link" />}>
                            <input readOnly value={link.link} aria-label="Link para conectar team@" onFocus={e => e.target.select()} />
                            <Button icon={<Icono n="copiar" />} onClick={copiar}>Copiar</Button>
                        </InputGroup>
                    )}
                </div>
            )}
            {st?.ultimo_error && <FieldError role="note">Último error de Google: {st.ultimo_error}</FieldError>}
            <Mensajes error={msg.error} aviso={msg.aviso} />
        </Tarjeta>
    );
}
