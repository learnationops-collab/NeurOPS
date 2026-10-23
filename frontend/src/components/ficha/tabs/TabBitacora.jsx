// Pestaña «Bitácora» (23/10/2026): todo lo que pasó con el lead, por tramos — Pre call, Call y venta,
// Primer mes y Segundo y tercer mes de la Academia — para saber qué pasó en cada momento.
//
// Pide sus datos aparte de la ficha (`GET /ficha/bitacora`), como Fulfillment: la parte de la
// Academia es de otro sistema y no puede trabar la apertura del modal. Si la Academia no responde, el
// backend manda lo de Work y un aviso.

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Chip, IconButton } from '../../standard';
import { Hueso } from '../../huesos/Huesos';
import { Aviso, SeccionColapsable, diaLegible, instanteLegible } from '../piezas';
import { mensajeDeError, obtenerBitacora } from '../fichaApi';
import './bitacora.css';

const color = (tono) => `var(--${tono || 'idle'})`;

const rangoDe = (t) => (t.desde
    ? `${diaLegible(t.desde)}${t.hasta ? ` – ${diaLegible(t.hasta)}` : ' en adelante'}`
    : null);

const Entrada = ({ e }) => (
    <div className="fi-sec-fila fi-bita-fila">
        <span className="t-sm mut">{instanteLegible(e.fecha)}</span>
        <span className="fi-bita-que">
            <span className="t-sm">{e.que}</span>
            {(e.detalle || e.por) && (
                <small className="t-cap mut">{[e.detalle, e.por && `por ${e.por}`].filter(Boolean).join(' · ')}</small>
            )}
            {(e.link || e.captura) && (
                <small className="t-cap">
                    {e.link && <a href={e.link} target="_blank" rel="noreferrer">Prueba</a>}
                    {e.link && e.captura && ' · '}
                    {e.captura && <a href={e.captura} target="_blank" rel="noreferrer">Captura</a>}
                </small>
            )}
        </span>
        <span className="fi-bita-chips">
            {e.origen === 'academia' && <Chip subtle>Academia</Chip>}
            <Chip color={color(e.tono)}>{e.grupo}</Chip>
        </span>
    </div>
);

const Tramo = ({ t, abierto }) => {
    const rango = rangoDe(t);
    const n = t.entradas.length;
    return (
        <SeccionColapsable titulo={t.label} abiertaPorDefecto={abierto}
            resumen={[rango, `${n} ${n === 1 ? 'registro' : 'registros'}`].filter(Boolean).join(' · ')}>
            {n
                ? t.entradas.map(e => <Entrada key={e.id} e={e} />)
                : <p className="t-cap mut40" style={{ paddingTop: 'var(--s3)' }}>Nada registrado en este tramo.</p>}
        </SeccionColapsable>
    );
};

const TabBitacora = ({ ficha }) => {
    const appointmentId = ficha?.identidad?.appointment_id ?? null;
    const clientId = ficha?.identidad?.client_id ?? null;
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(true);

    const cargar = useCallback((signal) => {
        setCargando(true);
        setError(null);
        obtenerBitacora({ appointmentId, clientId, signal })
            .then(setDatos)
            .catch((err) => { if (!signal?.aborted) setError(mensajeDeError(err)); })
            .finally(() => { if (!signal?.aborted) setCargando(false); });
    }, [appointmentId, clientId]);

    useEffect(() => {
        const ctrl = new AbortController();
        cargar(ctrl.signal);
        return () => ctrl.abort();
    }, [cargar]);

    if (cargando && !datos) {
        return <div style={{ display: 'grid', gap: 'var(--s3)' }}>{[0, 1, 2, 3].map(i => <Hueso key={i} alto={44} />)}</div>;
    }
    if (error) {
        return (
            <Aviso tono="error" titulo="No se pudo cargar la bitácora">
                {error} <IconButton icon={<RefreshCw size={14} />} label="Reintentar" size="xs" onClick={() => cargar()} />
            </Aviso>
        );
    }
    // Abierto el tramo más reciente con registros: es donde está parado el lead.
    const actual = [...datos.tramos].reverse().find(t => t.entradas.length)?.key;
    return (
        <div style={{ display: 'grid', gap: 'var(--s3)' }}>
            {datos.aviso_academia && <Aviso tono="warning" titulo={datos.aviso_academia} />}
            {datos.tramos.map(t => <Tramo key={t.key} t={t} abierto={t.key === actual} />)}
        </div>
    );
};

export default TabBitacora;
