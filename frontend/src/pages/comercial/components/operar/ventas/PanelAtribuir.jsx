import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import AttributionModal from '../../../../../components/modals/AttributionModal';
import Modal from '../../../../../components/ui/Modal';
import { getVenta } from './ventasApi';

/**
 * «Atribuir a una agenda» del «⋯» de una venta sin agenda (10/10/2026, antes en la tabla vieja de
 * Ventas de Operaciones).
 *
 * Es el MISMO `AttributionModal` de la tabla vieja: corregir el Instagram de la venta, vincularla a
 * una agenda que ya existe o crear la agenda que falta. Ese modal trabaja con la venta tal como la
 * manda `GET /public/financial-sales` (`nombre_cliente`, `email_vendedor`, `mail_cliente`…), que no
 * es la fila de Revisar: se la pide por su id al abrir, y mientras llega se ve un modal de carga en
 * el mismo lugar. Cualquier corrección recarga la tabla, así la fila deja de decir «Sin agenda».
 */
const PanelAtribuir = ({ fila, onCerrar, onHecho }) => {
    const [venta, setVenta] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let vigente = true;
        getVenta(fila.id)
            .then((v) => { if (!vigente) return; if (v) setVenta(v); else setError(true); })
            .catch(() => { if (vigente) setError(true); });
        return () => { vigente = false; };
    }, [fila.id]);

    if (venta) return <AttributionModal sale={venta} onClose={onCerrar} onSuccess={onHecho} />;

    return (
        <Modal ancho="md" titulo="Atribuir a una agenda" subtitulo={fila.cliente} onCerrar={onCerrar}
            icono={<Users className="text-indigo-400" size={20} />}>
            {error ? (
                <p role="alert" className="text-[13px] font-semibold text-rose-300">
                    No se pudo abrir la venta. Cerrá y probá de nuevo.
                </p>
            ) : (
                <div className="grid gap-2" aria-label="Cargando la venta">
                    <div className="h-4 w-2/3 rounded-lg bg-slate-800/70 animate-pulse motion-reduce:animate-none" />
                    <div className="h-10 rounded-xl bg-slate-800/50 animate-pulse motion-reduce:animate-none" />
                </div>
            )}
        </Modal>
    );
};

export default PanelAtribuir;
