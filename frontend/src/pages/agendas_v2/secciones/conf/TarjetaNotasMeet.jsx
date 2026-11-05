// Notas de Meet (Operaciones › Integraciones): las cuentas de Google de cuyos Drives Work lee las notas de
// Gemini. Varias a la vez: se suman con «Conectar cuenta de Google» (Google pregunta cuál) o con un link
// firmado para quien tenga la otra cuenta (app/api/notas_meet.py).

import { useEffect, useState } from 'react';
import api from '../../../../services/api';
import { Icono } from '../../ui/base';
import { Button, ConfirmDelete, FieldError, InputGroup } from '../../../../components/standard';
import { Estado, Mensajes, Tarjeta } from './cuenta';

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'leyendo por primera vez');

function FilaCuenta({ c, ocupado, onQuitar }) {
    const [confirmar, setConfirmar] = useState(false);
    return (
        <>
            <div className="cu-fila">
                <p className="t-sm" style={{ flex: '1 1 220px' }}>
                    <b>{c.email}</b> · {c.notas} notas · última lectura: {fecha(c.ultima_lectura)}
                </p>
                {!c.conectada && <Estado ok={false} no="Vencida: volvé a conectarla" />}
                <Button variant="danger" disabled={ocupado} onClick={() => setConfirmar(true)}>Desconectar</Button>
            </div>
            {confirmar && (
                <ConfirmDelete name={c.email} confirmLabel="Desconectar" detail="Sus notas quedan; dejan de entrar las nuevas."
                    onCancel={() => setConfirmar(false)} onConfirm={() => { setConfirmar(false); onQuitar(c.email); }} />
            )}
            {c.ultimo_error && <FieldError role="note">Último error de Google ({c.email}): {c.ultimo_error}</FieldError>}
        </>
    );
}

export default function TarjetaNotasMeet() {
    const [st, setSt] = useState(null);
    const [link, setLink] = useState(null);
    const [msg, setMsg] = useState({});
    const [ocupado, setOcupado] = useState(false);

    const leer = () => api.get('/notas-meet/estado').then(r => setSt(r.data)).catch(() => setSt({ conectada: false, cuentas: [] }));
    useEffect(() => { leer(); }, []);

    const correr = async (fn) => {
        setOcupado(true);
        setMsg({});
        try { await fn(); } catch (e) { setMsg({ error: e.response?.data?.error || 'Algo falló. Probá de nuevo.' }); } finally { setOcupado(false); }
    };
    const generar = () => correr(async () => { setLink((await api.post('/notas-meet/link')).data); });
    // Con la sesión de Google de este navegador: Google pregunta qué cuenta y vuelve acá.
    const conectar = () => correr(async () => { window.location.assign((await api.post('/notas-meet/link')).data.link + '?volver=1'); });
    const copiar = () => navigator.clipboard?.writeText(link.link).then(() => setMsg({ aviso: 'Link copiado.' }));
    const leerAhora = () => correr(async () => {
        await api.post('/notas-meet/sincronizar');
        setMsg({ aviso: 'Leyendo los Drives. Una cuenta nueva tarda unos minutos la primera vez.' });
    });
    const quitar = (email) => correr(async () => {
        await api.post('/notas-meet/desconectar', { email });
        await leer();
    });

    const cuentas = st?.cuentas || [];
    return (
        <Tarjeta icono="video" titulo="Notas de Meet"
            texto="Work lee cada 15 minutos las notas que Gemini deja en el Drive de cada cuenta conectada. Si la misma reunión está en dos cuentas, queda una sola nota."
            estado={st && <Estado ok={!!st.conectada} si={`${cuentas.length} ${cuentas.length === 1 ? 'cuenta' : 'cuentas'}`} no="Sin conectar" />}>
            {!st ? <p className="t-sm mut">Cargando…</p> : (
                <>
                    {cuentas.map(c => <FilaCuenta key={c.email} c={c} ocupado={ocupado} onQuitar={quitar} />)}
                    {cuentas.length > 0 && (
                        <p className="t-sm mut">{st.notas} notas en total ({st.vinculadas} con su agenda de venta).</p>
                    )}
                    <div className="cu-fila">
                        <Button variant="primary" icon={<Icono n="plus" />} disabled={ocupado} onClick={conectar}>
                            {cuentas.length ? 'Conectar otra cuenta' : 'Conectar cuenta de Google'}
                        </Button>
                        <Button disabled={ocupado} onClick={generar}>Link para otra persona</Button>
                        {st.conectada && <Button icon={<Icono n="rotar" />} disabled={ocupado} onClick={leerAhora}>Leer ahora</Button>}
                    </div>
                    {link && (
                        <InputGroup prefix={<Icono n="link" />}>
                            <input readOnly value={link.link} aria-label="Link para conectar otra cuenta" onFocus={e => e.target.select()} />
                            <Button icon={<Icono n="copiar" />} onClick={copiar}>Copiar</Button>
                        </InputGroup>
                    )}
                </>
            )}
            <Mensajes error={msg.error} aviso={msg.aviso} />
        </Tarjeta>
    );
}
