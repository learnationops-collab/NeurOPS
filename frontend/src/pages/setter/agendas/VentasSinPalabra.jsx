import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { Tip } from '../../comercial/components/Shared';
import TarjetaVenta, { dinero } from './TarjetaVenta';
import { useVentasSinPalabra } from './useVentasSinPalabra';
import { ventasDelMes } from './meses';

/**
 * Las ventas de los leads del setter y su palabra clave (Kerwin, 17/10/2026: «esas ventas deben aparecer
 * en los setters para que ellos decidan de qué palabra clave vino cada una, agrupado por cliente»).
 * Un cliente por tarjeta: la palabra clave va a TODOS sus pagos y Marketing los suma a ese anuncio
 * (`ventas_palabra_clave_service`). Desde el 04/11/2026 las que faltan van en «Pendientes» junto a las
 * agendas, y las que ya la tienen en «Completadas»: los dos usan el mismo estado (`useVentasSinPalabra`).
 */

/** Las ventas que faltan, por cliente. Al asignar, la tarjeta se va y el foco pasa a la siguiente. */
export const VentasPendientes = ({ ventas, mes = null, conVacio = false }) => {
    const { datos, anuncios, asignar, pasarAWorkshop } = ventas;
    const [aviso, setAviso] = useState('');
    const tarjetas = useRef(new Map());
    if (!datos) return null;
    // Las del mes elegido (04/11/2026): un cliente sale en cada mes en que pagó.
    const pendientes = ventasDelMes(datos.pendientes, mes);
    if (!pendientes.length && !conVacio) return null;
    const sinAnuncio = pendientes.reduce((t, g) => t + g.pagos.filter((p) => !p.palabra_clave)
        .reduce((s, p) => s + p.monto, 0), 0);

    const alAsignar = async (grupo, anuncio, instagram) => {
        const r = await asignar(grupo, anuncio, instagram);
        if (r.ok) {
            setAviso(r.aviso);
            if (r.siguiente) requestAnimationFrame(() => tarjetas.current.get(r.siguiente)?.focus());
        }
        return r;
    };

    const alPasarAWorkshop = async (grupo) => {
        const r = await pasarAWorkshop(grupo);
        if (r.ok) setAviso(r.aviso);
        return r;
    };

    return (
        <section className="mv-ventas" aria-labelledby="mv-titulo">
            <div className="mv-cab">
                <h2 id="mv-titulo" className="ma-mes-titulo">
                    Ventas sin palabra clave <span className="num">· {pendientes.length}</span>
                </h2>
                <Tip titulo="Ventas sin palabra clave"
                    texto="Ventas de tus leads que Marketing no sabe de qué anuncio vinieron." />
                {sinAnuncio > 0 && <span className="mv-monto num">{dinero(sinAnuncio)} sin anuncio</span>}
            </div>
            <span className="sr" aria-live="polite">{aviso}</span>

            {pendientes.length > 0 ? (
                <ul className="ma-lista">
                    <AnimatePresence initial={false}>
                        {pendientes.map((g, i) => (
                            <TarjetaVenta key={g.grupo} grupo={g} orden={i} anuncios={anuncios} onAsignar={alAsignar}
                                onWorkshop={alPasarAWorkshop}
                                ref={(el) => { if (el) tarjetas.current.set(g.grupo, el); else tarjetas.current.delete(g.grupo); }} />
                        ))}
                    </AnimatePresence>
                </ul>
            ) : (
                <p className="mv-vacio"><Check size={16} aria-hidden="true" />{mes ? 'Las ventas de este mes tienen su palabra clave.' : 'Todas tus ventas tienen su palabra clave.'}</p>
            )}
        </section>
    );
};

/** Los clientes que ya tienen palabra clave, plegados; «Cambiar» abre la tarjeta del cliente (18/10/2026). */
export const VentasCompletadas = ({ ventas, mes = null }) => {
    const { datos, anuncios, asignar } = ventas;
    const [verHechas, setVerHechas] = useState(false);
    const [cambiando, setCambiando] = useState(null);
    const [aviso, setAviso] = useState('');
    const cambioRef = useRef(null);
    // Al abrir el cambio, el foco va a su buscador: se escribe la palabra clave nueva y Enter.
    useEffect(() => { if (cambiando) cambioRef.current?.focus(); }, [cambiando]);
    const completadas = datos ? ventasDelMes(datos.completadas, mes) : [];
    if (!completadas.length) return null;

    const alCambiar = async (grupo, anuncio, instagram) => {
        const r = await asignar(grupo, anuncio, instagram);
        if (r.ok) { setAviso(r.aviso); setCambiando(null); }
        return r;
    };

    return (
        <section className="mv-ventas" aria-label="Ventas con palabra clave">
            <span className="sr" aria-live="polite">{aviso}</span>
            <div className="mv-hechas">
                <button type="button" className="mv-hechas-btn" aria-expanded={verHechas}
                    onClick={() => setVerHechas((v) => !v)}>
                    <ChevronDown size={15} aria-hidden="true" className={verHechas ? 'mv-girada' : undefined} />
                    {`${completadas.length} ${completadas.length === 1 ? 'cliente' : 'clientes'} con ventas y palabra clave`}
                </button>
                {verHechas && (
                    <ul className="mv-hechas-lista">
                        {completadas.map((g) => (cambiando === g.grupo ? (
                            <TarjetaVenta key={g.grupo} grupo={g} anuncios={anuncios} onAsignar={alCambiar}
                                onCancelar={() => setCambiando(null)} ref={cambioRef} />
                        ) : (
                            <li key={g.grupo} className="mv-hecha">
                                <span className="trunc">{g.cliente}</span>
                                <span className="num">{dinero(g.total)}</span>
                                <small className="mv-con trunc" title={g.elegida ? 'La elegiste vos' : 'La encontró ManyChat'}>
                                    {g.palabras.join(' · ')}
                                </small>
                                {g.cambiable && (
                                    <button type="button" className="ma-ig-cambiar" onClick={() => setCambiando(g.grupo)}
                                        aria-label={`Cambiar la palabra clave de ${g.cliente}`}>
                                        Cambiar
                                    </button>
                                )}
                            </li>
                        )))}
                    </ul>
                )}
            </div>
        </section>
    );
};

/** Las dos partes juntas, con su propio estado: lo que usa quien no reparte las ventas en pestañas. */
const VentasSinPalabra = ({ anuncios }) => {
    const ventas = useVentasSinPalabra(anuncios);
    if (!ventas.datos || (!ventas.datos.pendientes.length && !ventas.datos.completadas.length)) return null;
    return (
        <>
            <VentasPendientes ventas={ventas} conVacio />
            <VentasCompletadas ventas={ventas} />
        </>
    );
};

export default VentasSinPalabra;
