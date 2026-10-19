import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import api from '../../../../services/api';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import EsqueletoLista from '../../../../components/listas/EsqueletoLista';
import InlineConfirm from '../../../../components/ui/InlineConfirm';
import { Button } from '../../../../components/standard';
import { PanelCab } from '../../../comercial/components/Shared';
import { COLUMNAS_DETALLE, FACETAS_DETALLE, buscarEnVisita } from './columnas';
import { EVENTO, LIMITE_DETALLE, fechaHora, num } from './trafico';

/**
 * Cada visita y cada clic al grupo del período, con sus UTM (lo que antes era Marketing › «Tráfico
 * landings», que pedía un endpoint de admin). Clic en una fila: su ficha completa, y borrarla para
 * quien puede (admin y operator, `puede_borrar` del backend), con el deshacer de `InlineConfirm`.
 */

const AYUDA = 'Una fila por cada carga de una landing (y por cada clic al botón del grupo de WhatsApp), '
    + 'de la más nueva a la más vieja. La grabación (/replay/) no está: se cuenta por sus sesiones, en Talleres.';

const Campo = ({ rotulo, valor }) => (
    <div className="wf-campo">
        <span className="t-rotulo">{rotulo}</span>
        <span className="wf-campo-v" title={valor || undefined}>{valor || '—'}</span>
    </div>
);

const FichaVisita = ({ visita, puedeBorrar, onBorrar, onCerrar }) => {
    const reducir = useReducedMotion();
    return (
        <motion.div className="hundido wf-ficha" aria-label="Visita elegida"
            initial={reducir ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.7, 0.2, 1] }}>
            <div className="wf-ficha-cab">
                <p className="t-eyebrow">{EVENTO[visita.evento] || visita.evento} · {fechaHora(visita.created_at)}</p>
                <div className="wf-ficha-acc">
                    {puedeBorrar && (
                        <InlineConfirm tema="tema" compacto alto={32} tamIcono={13} label="Borrar visita"
                            question="¿Borrar?" doneLabel="Borrada" title="Borra esta visita del registro"
                            onConfirm={() => onBorrar(visita)} />
                    )}
                    <button type="button" className="ibtn ibtn--sm" onClick={onCerrar} aria-label="Cerrar la visita">
                        <X aria-hidden="true" />
                    </button>
                </div>
            </div>
            <div className="wf-campos">
                <Campo rotulo="Landing" valor={visita.landing} />
                <Campo rotulo="Página" valor={visita.page_path} />
                <Campo rotulo="Fuente" valor={visita.fuente} />
                <Campo rotulo="utm_source" valor={visita.utm_source} />
                <Campo rotulo="utm_medium" valor={visita.utm_medium} />
                <Campo rotulo="Campaña" valor={visita.campana_nombre} />
                <Campo rotulo="utm_campaign" valor={visita.utm_campaign} />
                <Campo rotulo="Anuncio" valor={visita.anuncio_nombre} />
                <Campo rotulo="utm_content" valor={visita.utm_content} />
                <Campo rotulo="Referrer" valor={visita.referrer} />
            </div>
        </motion.div>
    );
};

const DetalleVisitas = ({ desde, hasta, version, onBorrada }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [elegida, setElegida] = useState(null);
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        const control = new AbortController();
        setError(null);
        api.get('/workshop/landing/trafico/visitas', {
            params: { desde, hasta, limite: LIMITE_DETALLE }, signal: control.signal,
        })
            .then((r) => setDatos(r.data))
            .catch((e) => {
                if (e?.name !== 'CanceledError') setError('No se pudo cargar el detalle de visitas.');
            });
        return () => control.abort();
    }, [desde, hasta, version, intento]);

    // Otro período: la visita elegida ya no es de esta lista.
    useEffect(() => { setElegida(null); }, [desde, hasta]);

    const borrar = async (visita) => {
        try {
            await api.delete(`/v1/metrics/track-visit/${visita.id}`);
            setDatos((d) => (d ? { ...d, visitas: d.visitas.filter((v) => v.id !== visita.id) } : d));
            setElegida((e) => (e?.id === visita.id ? null : e));
            onBorrada?.();
        } catch {
            toast.error('No se pudo borrar la visita.');
        }
    };

    const visitas = datos?.visitas || [];

    return (
        <section className="panel wf-panel wf-detalle" aria-label="Detalle de visitas">
            <PanelCab titulo="Visitas una por una" tip={AYUDA}>
                {datos?.recortado && (
                    <span className="t-cap mut40 num">las {num(datos.limite)} más recientes · acotá el período para ver el resto</span>
                )}
            </PanelCab>
            {error && !datos ? (
                <p className="t-body mut40">
                    {error} <Button size="sm" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
                </p>
            )
                : !datos ? (
                    <EsqueletoLista columnas={COLUMNAS_DETALLE} facetas={FACETAS_DETALLE}
                        claveGuardado="ws_trafico_visitas_cols" label="Cargando las visitas…" />
                )
                    : (
                        <>
                            {elegida && (
                                <FichaVisita key={elegida.id} visita={elegida} puedeBorrar={datos.puede_borrar}
                                    onBorrar={borrar} onCerrar={() => setElegida(null)} />
                            )}
                            <ListaConfigurable columnas={COLUMNAS_DETALLE} facetas={FACETAS_DETALLE} filas={visitas}
                                clave={(v) => v.id} onAbrirFila={setElegida} buscar={buscarEnVisita}
                                buscarPlaceholder="Buscar…" claveGuardado="ws_trafico_visitas_cols"
                                vacio="No hay visitas en este período." />
                        </>
                    )}
        </section>
    );
};

export default DetalleVisitas;
