import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, CircleDashed, RefreshCw, Search } from 'lucide-react';
import { EsqueletoFilas } from '../../../comercial/components/Shared';
import { diaLocal, formatear } from './metricas';
import { asignarClaveDeMeta, mensajeDeError, pedirAnunciosDeMeta, sincronizarMeta } from './marketingApi';

/**
 * La conexión con Meta Ads: si está conectada, cuándo se sincronizó, qué anuncios publicados hay y a
 * qué palabra clave de ManyChat va el gasto de cada uno (ver `app/services/meta_ads_service.py`).
 *
 * «Automática» deja que la sincronización la busque en el texto del anuncio («Comenta QUIERO
 * APLICAR…»); elegir una la fija; «Ninguna» dice que ese anuncio no es de ManyChat (una landing, por
 * ejemplo) y su gasto queda fuera de la tabla.
 */

const AUTO = '__auto';
const NINGUNA = '__ninguna';
const TRAMO = 30;

const diaAnterior = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    return diaLocal(new Date(a, m - 1, d - 1));
};

const ESTADOS = {
    ACTIVE: { label: 'Activo', tono: 'success' },
    PAUSED: { label: 'Pausado', tono: 'idle' },
    ADSET_PAUSED: { label: 'Conjunto pausado', tono: 'idle' },
    CAMPAIGN_PAUSED: { label: 'Campaña pausada', tono: 'idle' },
    WITH_ISSUES: { label: 'Con problemas', tono: 'warning' },
    DISAPPROVED: { label: 'Rechazado', tono: 'error' },
    PENDING_REVIEW: { label: 'En revisión', tono: 'info' },
    ARCHIVED: { label: 'Archivado', tono: 'idle' },
};

const PASOS = [
    'En el Business Manager de Neurocogniciones LLC: Configuración del negocio › Usuarios del sistema › Agregar (por ejemplo «NeurOPS»).',
    'Asignale la cuenta publicitaria «Mario Bühler Aprendizaje | New C. Pub» con permiso para ver el rendimiento.',
    'Generá el token del usuario del sistema con la app de Meta propia y el permiso ads_read (no vence).',
    'En Railway, cargá META_ADS_TOKEN con ese token y META_AD_ACCOUNT_IDS=886943269514111.',
    'Volvé acá y tocá «Sincronizar» con 90 días: trae el gasto de cada anuncio por día y lo asocia solo a su palabra clave. Desde ahí, el cron lo actualiza cada mañana.',
];

const hace = (iso) => {
    if (!iso) return 'nunca';
    const f = new Date(`${iso}Z`);
    const min = Math.round((Date.now() - f.getTime()) / 60000);
    if (min < 1) return 'recién';
    if (min < 60) return `hace ${min} min`;
    if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
    return f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ConexionMeta = ({ desde, hasta, filasTablero, onCambio }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [dias, setDias] = useState(30);
    const [sincronizando, setSincronizando] = useState(false);
    const [guardando, setGuardando] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [soloActivos, setSoloActivos] = useState(false);

    const cargar = useCallback(async (signal) => {
        try {
            setDatos(await pedirAnunciosDeMeta(desde, hasta, { signal }));
            setError(null);
        } catch (e) {
            if (e?.name !== 'CanceledError') setError(mensajeDeError(e, 'No se pudieron traer los anuncios de Meta.'));
        }
    }, [desde, hasta]);

    useEffect(() => {
        const control = new AbortController();
        cargar(control.signal);
        return () => control.abort();
    }, [cargar]);

    // De a tramos de 30 días, del más nuevo al más viejo: 180 días de una vez pasaban el tiempo que el
    // servidor le da a un pedido. Si un tramo falla, lo ya traído queda guardado.
    const sincronizar = async () => {
        const tramos = Math.ceil(dias / TRAMO);
        let hasta = null;
        let gasto = 0;
        let desde = null;
        let ultimo = null;
        try {
            for (let i = 0; i < tramos; i += 1) {
                setSincronizando({ hecho: i, total: tramos });
                const r = await sincronizarMeta(Math.min(TRAMO, dias - i * TRAMO), hasta);
                gasto += r.gasto;
                ultimo = ultimo || r.hasta;
                desde = r.desde;
                hasta = diaAnterior(r.desde);
            }
            toast.success(`Listo: ${formatear(gasto, 'money')} de gasto de Meta (${desde} a ${ultimo}).`);
        } catch (e) {
            toast.error(mensajeDeError(e, 'No se pudo sincronizar con Meta.')
                + (desde ? ` Quedó guardado del ${desde} al ${ultimo}.` : ''));
        } finally {
            setSincronizando(false);
            if (desde) {
                await cargar();
                onCambio?.();
            }
        }
    };

    const elegir = async (anuncio, valor) => {
        setGuardando(anuncio.meta_ad_id);
        const cuerpo = valor === AUTO ? { automatico: true } : { clave: valor === NINGUNA ? null : valor };
        try {
            const r = await asignarClaveDeMeta(anuncio.meta_ad_id, cuerpo);
            setDatos((d) => ({ ...d, anuncios: d.anuncios.map((a) => (a.meta_ad_id === anuncio.meta_ad_id ? { ...a, ...r } : a)) }));
            onCambio?.();
        } catch (e) {
            toast.error(mensajeDeError(e, 'No se pudo guardar la palabra clave.'));
        } finally {
            setGuardando(null);
        }
    };

    const anuncios = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        return (datos?.anuncios || []).filter((a) => (!soloActivos || a.estado === 'ACTIVE')
            && (!texto || [a.nombre, a.campana, a.conjunto, a.clave, a.texto].some((x) => (x || '').toLowerCase().includes(texto))));
    }, [datos, busqueda, soloActivos]);

    const cobertura = useMemo(() => {
        const todos = datos?.anuncios || [];
        const activos = todos.filter((a) => a.estado === 'ACTIVE');
        return {
            activos: activos.length,
            activosConClave: activos.filter((a) => a.clave).length,
            sinClaveConGasto: todos.filter((a) => !a.clave && a.gasto > 0),
            organicas: (filasTablero || []).filter((f) => f.clave && !f.meta?.anuncios && f.entrantes > 0 && !f.archivado),
        };
    }, [datos, filasTablero]);

    if (error) return <section className="panel"><p className="t-body">{error}</p></section>;
    if (!datos) return <section className="panel"><EsqueletoFilas rotulo="Cargando los anuncios de Meta…" lineas={6} /></section>;

    const gastoSinClave = cobertura.sinClaveConGasto.reduce((s, a) => s + a.gasto, 0);

    return (
        <div className="vista mk-vista">
            <div className="grid-2">
                <section className="panel mk-conexion">
                    <div className="panel-cab">
                        <div className="mk-cab-txt">
                            <p className="t-eyebrow">Meta Ads</p>
                            <h2 className="t-h3">{datos.conectado ? 'Conectado' : 'Sin conectar'}</h2>
                        </div>
                        <span className="chip" style={{ '--c': `var(--${datos.muestra ? 'info' : datos.conectado ? 'success' : 'warning'})` }}>
                            {datos.conectado ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                            {datos.muestra ? 'Datos de muestra' : datos.conectado ? 'Gasto automático' : 'Falta el token'}
                        </span>
                    </div>
                    {datos.conectado ? (
                        <p className="t-cap mut">
                            Última sincronización: <b>{hace(datos.ultima_sincronizacion)}</b>. El cron trae cada mañana el gasto
                            de los últimos 7 días (Meta todavía ajusta los días recientes).
                        </p>
                    ) : (
                        <ol className="mk-pasos t-cap mut">
                            {PASOS.map((p) => <li key={p}>{p}</li>)}
                        </ol>
                    )}
                    <div className="mk-sinc">
                        <label className="mk-select-caja">
                            <span className="sr-only">Días para atrás</span>
                            <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="mk-select">
                                <option value={7}>Últimos 7 días</option>
                                <option value={30}>Últimos 30 días</option>
                                <option value={90}>Últimos 90 días</option>
                                <option value={180}>Últimos 180 días</option>
                            </select>
                        </label>
                        <button type="button" className="btn btn--cta btn--sm" onClick={sincronizar}
                            disabled={sincronizando || !datos.conectado || datos.muestra}
                            title={datos.muestra ? 'Son datos de muestra del servidor de prueba' : datos.conectado ? 'Traer ahora el gasto de Meta' : 'Primero hay que cargar el token en Railway'}>
                            <RefreshCw className={sincronizando ? 'mk-gira' : ''} aria-hidden="true" />
                            {!sincronizando ? 'Sincronizar'
                                : sincronizando.total > 1 ? `Sincronizando ${sincronizando.hecho + 1} de ${sincronizando.total}…`
                                    : 'Sincronizando…'}
                        </button>
                    </div>
                </section>

                <section className="panel">
                    <div className="panel-cab">
                        <div className="mk-cab-txt">
                            <p className="t-eyebrow">Qué se está midiendo</p>
                            <h2 className="t-h3">Cobertura</h2>
                        </div>
                    </div>
                    <div className="pareja mk-cobertura" style={{ '--min': '140px' }}>
                        <div className="tarjeta">
                            <p className="t-eyebrow">Activos en Meta</p>
                            <p className="mk-cob-n num">{cobertura.activos}</p>
                            <p className="t-cap mut40">{cobertura.activosConClave} con palabra clave</p>
                        </div>
                        <div className="tarjeta">
                            <p className="t-eyebrow">Gasto sin palabra clave</p>
                            <p className="mk-cob-n num">{formatear(gastoSinClave, 'money')}</p>
                            <p className="t-cap mut40">{cobertura.sinClaveConGasto.length} anuncios en el período</p>
                        </div>
                        <div className="tarjeta">
                            <p className="t-eyebrow">Sin anuncio en Meta</p>
                            <p className="mk-cob-n num">{cobertura.organicas.length}</p>
                            <p className="t-cap mut40">palabras clave con leads</p>
                        </div>
                    </div>
                    {cobertura.organicas.length > 0 && (
                        <p className="t-cap mut40 mk-organicas">
                            {cobertura.organicas.slice(0, 12).map((f) => f.nombre).join(' · ')}
                            {cobertura.organicas.length > 12 ? ' …' : ''}
                        </p>
                    )}
                </section>
            </div>

            <section className="panel mk-panel-tabla">
                <div className="panel-cab mk-tabla-barra">
                    <div className="mk-cab-txt">
                        <h2 className="t-h3">Anuncios publicados en Meta</h2>
                        <p className="t-cap mut40">A qué palabra clave de ManyChat va el gasto de cada uno.</p>
                    </div>
                    <div className="panel-cab-der">
                        <label className="busca busca--sm mk-busca">
                            <Search aria-hidden="true" />
                            <input type="search" placeholder="Buscar anuncio" value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar anuncio de Meta" />
                        </label>
                        <button type="button" className={`pastilla pastilla--sm${soloActivos ? ' pastilla--on' : ''}`}
                            aria-pressed={soloActivos} onClick={() => setSoloActivos((v) => !v)}>
                            Solo activos
                        </button>
                    </div>
                </div>
                {!datos.anuncios.length ? (
                    <p className="t-cap mut mk-vacio">
                        {datos.conectado
                            ? 'Todavía no hay anuncios sincronizados: tocá «Sincronizar».'
                            : 'Cuando Meta Ads esté conectado, acá vas a ver cada anuncio publicado con su gasto y su palabra clave.'}
                    </p>
                ) : (
                    <div className="mk-tabla-caja">
                        <table className="mk-tabla mk-tabla--meta">
                            <thead>
                                <tr>
                                    <th className="mk-col-nombre" scope="col">Anuncio</th>
                                    <th scope="col">Estado</th>
                                    <th scope="col">Texto del anuncio</th>
                                    <th scope="col">Palabra clave</th>
                                    <th scope="col" className="mk-num">Gastado en el período</th>
                                </tr>
                            </thead>
                            <tbody>
                                {anuncios.map((a) => {
                                    const estado = ESTADOS[a.estado] || { label: a.estado || '—', tono: 'idle' };
                                    const valor = a.mapeo === 'manual' ? (a.clave || NINGUNA) : AUTO;
                                    return (
                                        <tr key={a.meta_ad_id}>
                                            <td className="mk-col-nombre">
                                                <div className="mk-nombre-txt">
                                                    <span className="mk-nombre-kw trunc" title={a.nombre}>{a.nombre}</span>
                                                    <span className="mk-nombre-sub trunc" title={`${a.campana} › ${a.conjunto}`}>
                                                        {a.campana} › {a.conjunto}
                                                    </span>
                                                </div>
                                            </td>
                                            <td><span className="chip" style={{ '--c': `var(--${estado.tono})` }}>{estado.label}</span></td>
                                            <td className="mk-texto" title={a.texto}>{a.texto || '—'}</td>
                                            <td>
                                                <div className="mk-clave">
                                                    <select className="mk-select" value={valor} disabled={guardando === a.meta_ad_id}
                                                        aria-label={`Palabra clave de ${a.nombre}`}
                                                        onChange={(e) => elegir(a, e.target.value)}>
                                                        <option value={AUTO}>{a.mapeo === 'auto' && a.clave ? `Automática: ${a.clave}` : 'Automática (no la encontró)'}</option>
                                                        <option value={NINGUNA}>Ninguna (no es de ManyChat)</option>
                                                        {datos.claves.map((c) => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="mk-num num">{formatear(a.gasto, 'money')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
};

export default ConexionMeta;
