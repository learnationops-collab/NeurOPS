import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import FlujoEmbudo from '../../../comercial/components/FlujoEmbudo';
import { EsqueletoTablero, PanelCab, Segmented } from '../../../comercial/components/Shared';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { Kpi } from './WorkshopFunnelView';
import { diaMes, duracion, numero } from '../talleres/formato';

/*
 * El embudo GENERAL de la landing de la grabación (/replay/), de todos los talleres juntos, por
 * período. Se abre desde Talleres («Landing de la grabación»); la grabación de cada taller y su
 * publicación se configuran en el detalle de ese taller.
 *
 * Ojo con no confundir los dos embudos:
 *   · Workshop en vivo  -> la clase en vivo, fuente 'workshop'
 *   · Workshop landing  -> esta grabación, fuente 'workshop landing'
 */

const ETAPAS = {
    entro: { texto: 'Entró', tono: 'idle' },
    abrio_gate: { texto: 'Abrió el registro', tono: 'warning' },
    completo_gate: { texto: 'Se registró', tono: 'info' },
    dio_play: { texto: 'Dio play', tono: 'info' },
    vio_oferta: { texto: 'Llegó a la oferta', tono: 'success' },
    clic_agenda: { texto: 'Clic en Calendly', tono: 'success' },
};
const etapaDe = (s) => ETAPAS[s.etapa] || ETAPAS.entro;

const fechaHora = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

const QUE_MIDE = 'Entraron: cargaron /replay/, una fila por visita. Abrieron el registro: tocaron «Ver la clase» y se abrió el '
    + 'formulario de 4 pasos (no es Calendly). Se registraron: completaron esos pasos. Dieron play: se montó el reproductor '
    + 'de Loom. Llegaron a la oferta: el bloque de la oferta entró de verdad en su pantalla. Clic en Calendly: tocaron agendar. '
    + 'Cada visita se mide por separado: quien ya se registró y vuelve entra directo a la clase.';

const COLUMNAS_SESIONES = [
    { key: 'persona', header: 'Persona', fija: true, width: 'minmax(150px,2fr)',
      valor: (s) => s.lead?.full_name || null,
      render: (s) => (s.lead
          ? <span className="celda" title={s.lead.full_name}>{s.lead.full_name}</span>
          : <span className="celda mut40">Sin registrarse</span>) },
    { key: 'examen', header: 'Examen', width: 'minmax(80px,1fr)', valor: (s) => s.lead?.examen || null,
      render: (s) => <span className="celda">{s.lead?.examen || '—'}</span> },
    { key: 'etapa', header: 'Etapa', width: 'minmax(120px,1.2fr)', valor: (s) => etapaDe(s).texto,
      render: (s) => <span className="chip" style={{ '--c': `var(--${etapaDe(s).tono})` }}><span className="trunc">{etapaDe(s).texto}</span></span> },
    { key: 'permanencia', header: 'Permanencia', alinear: 'der', width: 'minmax(80px,1fr)', valor: (s) => s.segundos_visible || 0,
      render: (s) => duracion(s.segundos_visible) },
    { key: 'video', header: 'Video', alinear: 'der', width: 'minmax(70px,1fr)', valor: (s) => (s.dio_play ? s.segundos_video || 0 : null),
      render: (s) => (s.dio_play ? duracion(s.segundos_video) : '—') },
    { key: 'origen', header: 'Origen', width: 'minmax(90px,1fr)', valor: (s) => s.utm_source || 'directo',
      render: (s) => <span className="celda">{s.utm_source || 'directo'}{s.dispositivo === 'movil' ? ' · móvil' : ''}</span> },
    { key: 'entro', header: 'Entró', width: 'minmax(100px,1fr)', valor: (s) => s.created_at,
      render: (s) => <span className="celda num">{fechaHora(s.created_at)}</span> },
];

const FACETAS_SESIONES = [
    { key: 'etapa', label: 'Etapa', de: (s) => etapaDe(s).texto },
    { key: 'registro', label: 'Registro', de: (s) => (s.lead ? 'Registrado' : 'Sin registrarse') },
    { key: 'play', label: 'Video', de: (s) => (s.dio_play ? 'Dio play' : 'Sin play') },
    { key: 'examen', label: 'Examen', de: (s) => s.lead?.examen || null },
    { key: 'origen', label: 'Origen', de: (s) => s.utm_source || 'directo' },
    { key: 'dispositivo', label: 'Dispositivo', de: (s) => (s.dispositivo === 'movil' ? 'Móvil' : 'Compu') },
];

const RANGOS = [{ key: 7, label: '7 días' }, { key: 30, label: '30 días' }, { key: 90, label: '90 días' }];

const WorkshopLandingView = () => {
    const [stats, setStats] = useState(null);
    const [sesiones, setSesiones] = useState([]);
    const [agendas, setAgendas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dias, setDias] = useState(30);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const hasta = new Date();
            const desde = new Date(hasta.getTime() - dias * 86400000);
            const rango = `desde=${desde.toISOString().slice(0, 10)}&hasta=${hasta.toISOString().slice(0, 10)}`;
            const [rStats, rSes, rAg] = await Promise.all([
                api.get(`/workshop/landing/stats?${rango}`),
                api.get(`/workshop/landing/sesiones?${rango}&limit=1000`),
                api.get(`/workshop/landing/agendas?${rango}`),
            ]);
            setStats(rStats.data);
            setSesiones(rSes.data || []);
            setAgendas(rAg.data);
        } catch (e) {
            console.error('[landing] Error al cargar', e);
            toast.error('No se pudieron cargar las métricas de la landing');
        } finally {
            setLoading(false);
        }
    }, [dias]);

    useEffect(() => { cargar(); }, [cargar]);

    const barra = (
        <div className="fila wt-landing-barra">
            <Segmented chico opciones={RANGOS} valor={dias} onChange={setDias} ariaLabel="Período de la landing" />
            <button type="button" className="ibtn ibtn--sm" onClick={cargar} disabled={loading}
                title="Volver a cargar" aria-label="Volver a cargar">
                <RefreshCw className={loading ? 'ws-gira' : ''} aria-hidden="true" />
            </button>
            {stats?.rango && <span className="t-cap mut num">Del {diaMes(stats.rango.desde)} al {diaMes(stats.rango.hasta)}</span>}
        </div>
    );

    if (loading && !stats) return <div className="vista wt-vista">{barra}<EsqueletoTablero rotulo="Cargando la landing…" /></div>;

    const e = stats?.embudo || {};
    const c = stats?.conversion || {};
    const p = stats?.permanencia || {};
    const visitas = e.visitas || 0;

    return (
        <div className={`vista wt-vista${loading ? ' wt-recargando' : ''}`}>
            {barra}

            <div className="pareja" style={{ '--min': '180px', '--g': 'var(--s3)' }}>
                <Kpi i={0} titulo="Visitas" valor={numero(visitas)} sub="Sesiones únicas"
                    tip="Cuánta gente distinta abrió la página de la grabación, se haya registrado o no." />
                <Kpi i={1} titulo="Registrados" valor={numero(e.completo_gate || 0)} sub={`${c.visita_a_registro || 0}% de las visitas`}
                    tip="De esas visitas, cuántas completaron el formulario para poder ver la clase." />
                <Kpi i={2} titulo="Dieron play" valor={numero(e.dio_play || 0)} sub={`${c.registro_a_play || 0}% de los registrados`}
                    tip="Si hay muchos registrados y pocos plays, el problema está en la página, no en el anuncio." />
                <Kpi i={3} titulo="Permanencia" valor={duracion(p.mediana_segundos)} sub={`Promedio ${duracion(p.promedio_segundos)}`}
                    tip="La mediana: la mitad se queda menos y la mitad más. El promedio se distorsiona con quien deja la pestaña abierta." />
            </div>

            <section className="panel wt-panel">
                <PanelCab titulo="Embudo de la grabación" tip={QUE_MIDE}>
                    <span className="t-cap mut num">Video visto {duracion(p.promedio_video_segundos)} en promedio</span>
                </PanelCab>
                <FlujoEmbudo raiz color="var(--brand-secondary)" etapas={[
                    { key: 'visitas', label: 'Entraron', n: visitas },
                    { key: 'gate', label: 'Abrieron registro', n: e.abrio_gate || 0 },
                    { key: 'registro', label: 'Se registraron', n: e.completo_gate || 0 },
                    { key: 'play', label: 'Dieron play', n: e.dio_play || 0 },
                    { key: 'oferta', label: 'Vieron la oferta', n: e.vio_oferta || 0 },
                    { key: 'calendly', label: 'Clic Calendly', n: e.clic_agenda || 0 },
                ]} />
            </section>

            <div className="pareja" style={{ '--min': '300px', '--g': 'var(--s4)' }}>
                <section className="panel wt-panel">
                    <PanelCab titulo="Agendas por fuente"
                        tip="Agendas creadas en el período que vinieron de la clase en vivo y de la grabación. Antes caían juntas (la fuente se detectaba buscando «workshop» en el texto)." />
                    <div className="pareja" style={{ '--min': '120px', '--g': 'var(--s3)' }}>
                        {[
                            ['Clase en vivo', agendas?.workshop_vivo, 'var(--info)'],
                            ['Grabación', agendas?.workshop_landing, 'var(--brand-secondary)'],
                        ].map(([titulo, d, color]) => (
                            <div key={titulo} className="tarjeta wt-fuente" style={{ '--c': color }}>
                                <p className="wt-fuente-titulo">{titulo}</p>
                                <b className="wt-fuente-n num">{numero(d?.total ?? 0)}</b>
                                <span className="t-cap mut40 num">{numero(d?.con_closer ?? 0)} con closer</span>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="panel wt-panel">
                    <PanelCab titulo="Registrados por examen" tip="A quién atrae la grabación: el examen que dijo cada registrado." />
                    {stats?.por_examen?.length ? (
                        <div className="wt-chips">
                            {stats.por_examen.map((x) => (
                                <span key={x.examen} className="chip" style={{ '--c': 'var(--text-muted)' }}>
                                    <span className="trunc">{x.examen}</span> <b className="num">{x.total}</b>
                                </span>
                            ))}
                        </div>
                    ) : <p className="t-cap mut40">Sin registrados en el período.</p>}
                </section>
            </div>

            <section className="panel wt-panel">
                <PanelCab titulo="Personas que entraron" tip="Cada visita a la landing de la grabación, con hasta dónde llegó." />
                <ListaConfigurable columnas={COLUMNAS_SESIONES} facetas={FACETAS_SESIONES} filas={sesiones}
                    clave={(s) => s.id} buscar={(s) => `${s.lead?.full_name || ''} ${s.lead?.examen || ''} ${s.utm_source || ''}`}
                    buscarPlaceholder="Buscar persona…" claveGuardado="workshop_landing_sesiones_columnas"
                    vacio="Todavía no hay visitas en este rango." />
            </section>
        </div>
    );
};

export default WorkshopLandingView;
