import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, CircleDashed, History } from 'lucide-react';
import { EsqueletoFilas, Tip } from '../../../comercial/components/Shared';
import ArbolMeta, { AUTO, NINGUNA } from './ArbolMeta';
import EnlaceMeta from './EnlaceMeta';
import { enlaceAdministrador } from './enlacesMeta';
import { diaLocal, formatear } from './metricas';
import { asignarClaveDeMeta, asignarEmbudoDeMeta, mensajeDeError, pedirAnunciosDeMeta, sincronizarMeta } from './marketingApi';

/**
 * Marketing › Meta Ads: la conexión con Meta y los anuncios publicados, desglosados como en el
 * Administrador de anuncios (campaña › conjunto › anuncio, `ArbolMeta`), con el embudo y la palabra
 * clave de ManyChat de cada uno (ver `app/services/meta_ads_service.py`).
 *
 * «Sincronizar» N días trae el historial de gasto con los creativos, en tramos de 30 días (180 días de
 * una vez pasaban el tiempo que el servidor le da a un pedido). Si un tramo falla, lo traído queda.
 *
 * «Automática» deja que la sincronización busque la palabra clave en el texto del anuncio («Comenta
 * QUIERO APLICAR…»); elegir una la fija; «Ninguna» dice que ese anuncio no es de ManyChat y su gasto
 * queda fuera de la tabla de Rendimiento. Lo elegido a mano no lo pisa ninguna sincronización.
 */

const TRAMO = 30;

const diaAnterior = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    return diaLocal(new Date(a, m - 1, d - 1));
};

const PASOS = [
    'En el Business Manager de Neurocogniciones LLC: Configuración del negocio › Usuarios del sistema › Agregar (por ejemplo «NeurOPS»).',
    'Asignale la cuenta publicitaria «Mario Bühler Aprendizaje | New C. Pub» con permiso para ver el rendimiento.',
    'Generá el token del usuario del sistema con la app de Meta propia y el permiso ads_read (no vence).',
    'En Railway, cargá META_ADS_TOKEN con ese token y META_AD_ACCOUNT_IDS con el id de la cuenta publicitaria.',
    'Volvé acá y tocá «Sincronizar» con 180 días: trae el gasto de cada anuncio por día y lo asocia solo a su palabra clave. Desde ahí, el cron lo actualiza cada mañana.',
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

const ConexionMeta = ({ desde, hasta, filasTablero, moneda, cuentas, version = 0, onCambio }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [dias, setDias] = useState(30);
    const [sincronizando, setSincronizando] = useState(false);
    const [guardando, setGuardando] = useState(null);

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
    }, [cargar, version]);

    const sincronizar = async () => {
        const tramos = Math.ceil(dias / TRAMO);
        let hastaTramo = null;
        let gasto = 0;
        let primero = null;
        let ultimo = null;
        try {
            for (let i = 0; i < tramos; i += 1) {
                setSincronizando({ hecho: i, total: tramos });
                const r = await sincronizarMeta(Math.min(TRAMO, dias - i * TRAMO), hastaTramo);
                gasto += r.gasto;
                ultimo = ultimo || r.hasta;
                primero = r.desde;
                hastaTramo = diaAnterior(r.desde);
            }
            toast.success(`Listo: ${formatear(gasto, 'money')} de gasto de Meta (${primero} a ${ultimo}).`);
        } catch (e) {
            toast.error(mensajeDeError(e, 'No se pudo sincronizar con Meta.')
                + (primero ? ` Quedó guardado del ${primero} al ${ultimo}.` : ''));
        } finally {
            setSincronizando(false);
            if (primero) {
                await cargar();
                onCambio?.();
            }
        }
    };

    const reemplazar = (r) => setDatos((d) => ({
        ...d, anuncios: d.anuncios.map((a) => (a.meta_ad_id === r.meta_ad_id ? { ...a, ...r } : a)),
    }));

    const elegirClave = async (anuncio, valor) => {
        setGuardando(anuncio.meta_ad_id);
        const cuerpo = valor === AUTO ? { automatico: true } : { clave: valor === NINGUNA ? null : valor };
        try {
            reemplazar(await asignarClaveDeMeta(anuncio.meta_ad_id, cuerpo));
            onCambio?.();
        } catch (e) {
            toast.error(mensajeDeError(e, 'No se pudo guardar la palabra clave.'));
        } finally {
            setGuardando(null);
        }
    };

    const elegirEmbudo = async (anuncio, valor) => {
        setGuardando(anuncio.meta_ad_id);
        try {
            reemplazar(await asignarEmbudoDeMeta(anuncio.meta_ad_id, valor === AUTO ? { automatico: true } : { embudo: valor }));
            onCambio?.();
        } catch (e) {
            toast.error(mensajeDeError(e, 'No se pudo guardar el embudo.'));
        } finally {
            setGuardando(null);
        }
    };

    const leadsPorClave = useMemo(() => Object.fromEntries((filasTablero || [])
        .filter((f) => f.clave).map((f) => [f.clave, f.entrantes || 0])), [filasTablero]);

    const cobertura = useMemo(() => {
        const todos = datos?.anuncios || [];
        const activos = todos.filter((a) => a.estado === 'ACTIVE');
        // Solo los de Setting (o sin clasificar): los de Workshop y Contratación no llevan palabra clave.
        const sinClave = todos.filter((a) => !a.clave && (!a.embudo || a.embudo === 'setting') && a.gasto > 0);
        return {
            gasto: todos.reduce((s, a) => s + (a.gasto || 0), 0),
            anuncios: todos.length,
            activos: activos.length,
            activosConClave: activos.filter((a) => a.clave).length,
            sinClave,
            gastoSinClave: sinClave.reduce((s, a) => s + a.gasto, 0),
            organicas: (filasTablero || []).filter((f) => f.clave && !f.meta?.anuncios && f.entrantes > 0 && !f.archivado),
        };
    }, [datos, filasTablero]);

    if (error) return <section className="panel"><p className="t-body">{error}</p></section>;
    if (!datos) return <section className="panel"><EsqueletoFilas rotulo="Cargando los anuncios de Meta…" lineas={6} /></section>;

    const listaCuentas = cuentas?.length ? cuentas : (datos.cuentas || []);
    const tono = datos.muestra ? 'info' : datos.conectado ? 'success' : 'warning';

    return (
        <div className="vista mk-vista">
            <section className="panel mk-conexion">
                <div className="mk-conexion-fila">
                    <div className="mk-conexion-id">
                        <span className="chip" style={{ '--c': `var(--${tono})` }}>
                            {datos.conectado ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                            {datos.muestra ? 'Datos de muestra' : datos.conectado ? 'Conectado' : 'Sin conectar'}
                        </span>
                        <span className="t-cap mut">
                            {datos.conectado ? <>Traído de Meta <b>{hace(datos.ultima_sincronizacion)}</b></> : 'Falta el token de Meta'}
                        </span>
                        <Tip titulo="Cómo se mantiene al día"
                            texto="«Sincronizar» trae el historial de gasto con los textos de los anuncios. El cron trae cada mañana los últimos 7 días. Lo que se clasifica acá a mano no lo pisa ninguna sincronización." />
                    </div>
                    <div className="mk-conexion-acc">
                        <EnlaceMeta href={enlaceAdministrador(listaCuentas[0])}>Administrador de anuncios</EnlaceMeta>
                        <span className="mk-sinc">
                            <label className="mk-select-caja">
                                <span className="sr-only">Días para atrás</span>
                                <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="mk-select">
                                    <option value={7}>Últimos 7 días</option>
                                    <option value={30}>Últimos 30 días</option>
                                    <option value={90}>Últimos 90 días</option>
                                    <option value={180}>Últimos 180 días</option>
                                </select>
                            </label>
                            <button type="button" className="btn btn--linea btn--sm" onClick={sincronizar}
                                disabled={!!sincronizando || !datos.conectado || datos.muestra}
                                title={datos.muestra ? 'Son datos de muestra del servidor de prueba' : datos.conectado ? 'Traer el historial de gasto de Meta' : 'Primero hay que cargar el token en Railway'}>
                                <History className={sincronizando ? 'mk-gira' : ''} aria-hidden="true" />
                                {!sincronizando ? 'Sincronizar'
                                    : sincronizando.total > 1 ? `Sincronizando ${sincronizando.hecho + 1} de ${sincronizando.total}…`
                                        : 'Sincronizando…'}
                            </button>
                        </span>
                    </div>
                </div>
                {!datos.conectado && (
                    <ol className="mk-pasos t-cap mut">
                        {PASOS.map((p) => <li key={p}>{p}</li>)}
                    </ol>
                )}
                <div className="pareja mk-cobertura" style={{ '--min': '170px', '--g': 'var(--s3)' }}>
                    <div className="tarjeta">
                        <p className="t-eyebrow">Gastado</p>
                        <p className="mk-cob-n num">{formatear(cobertura.gasto, 'money', moneda)}</p>
                        <p className="t-cap mut40">{cobertura.anuncios} anuncios en el período</p>
                    </div>
                    <div className="tarjeta">
                        <p className="t-eyebrow">Activos</p>
                        <p className="mk-cob-n num">{cobertura.activos}</p>
                        <p className="t-cap mut40">{cobertura.activosConClave} con palabra clave</p>
                    </div>
                    <div className="tarjeta">
                        <p className="t-eyebrow mk-eyebrow-tip">
                            Sin clave
                            <Tip titulo="Sin palabra clave" texto="Gasto de anuncios de Setting (o sin clasificar) que no tienen palabra clave de ManyChat: no suma en la tabla de Rendimiento. Se elige en su fila." />
                        </p>
                        <p className="mk-cob-n num">{formatear(cobertura.gastoSinClave, 'money', moneda)}</p>
                        <p className="t-cap mut40">{cobertura.sinClave.length} anuncios sin palabra clave</p>
                    </div>
                    <div className="tarjeta">
                        <p className="t-eyebrow mk-eyebrow-tip">
                            Sin anuncio
                            {cobertura.organicas.length > 0 && (
                                <Tip titulo="Palabras clave con leads y sin anuncio"
                                    texto={cobertura.organicas.map((f) => f.nombre).join(' · ')} />
                            )}
                        </p>
                        <p className="mk-cob-n num">{cobertura.organicas.length}</p>
                        <p className="t-cap mut40">palabras clave con leads, sin anuncio en Meta</p>
                    </div>
                </div>
            </section>

            <section className="panel mk-panel-tabla">
                <div className="panel-cab mk-tabla-barra">
                    <div className="mk-cab-txt">
                        <h2 className="t-h3">Campañas, conjuntos y anuncios</h2>
                    </div>
                </div>
                {!datos.anuncios.length ? (
                    <p className="t-cap mut mk-vacio">
                        {datos.conectado
                            ? 'Ningún anuncio gastó en el período (o todavía no se sincronizó: tocá «Sincronizar»).'
                            : 'Cuando Meta Ads esté conectado, acá vas a ver cada campaña, conjunto y anuncio con su gasto.'}
                    </p>
                ) : (
                    <ArbolMeta anuncios={datos.anuncios} claves={datos.claves} leadsPorClave={leadsPorClave}
                        cuentas={listaCuentas} moneda={moneda} guardando={guardando}
                        onElegirClave={elegirClave} onElegirEmbudo={elegirEmbudo} />
                )}
            </section>
        </div>
    );
};

export default ConexionMeta;
