import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import ModalConfirmacion from '../../ui/ModalConfirmacion';

/**
 * El «eliminar» de cualquier cosa del historial: una papelera (o un botón con texto) que abre el
 * modal de confirmación de la página.
 *
 * Una sola pieza para las cinco secciones —agendas, plan de cuotas, seguimientos, pagos y
 * eventos— porque el usuario pidió (29/09/2026) confirmar con "un modal de la página, no del
 * navegador" y después que "los demás datos de las pestañas de historial también se puedan
 * eliminar": si cada fila armara su propia papelera, terminaría habiendo dos formas de confirmar
 * en la misma pestaña, que es lo que había antes con el «¿Seguro?» en el lugar de los pagos.
 *
 * `children` es lo que el modal dice de ESO que se borra (qué es y qué arrastra). `onBorrar` se
 * espera: si rechaza, el modal muestra el motivo y sigue abierto; si resuelve, se cierra.
 */
const BorrarConConfirmacion = ({
    etiqueta, titulo, confirmar = 'Eliminar', confirmando = 'Eliminando…', texto = null,
    chico = true, disabled = false, onBorrar, children = null,
}) => {
    const [abierto, setAbierto] = useState(false);

    return (
        <>
            {texto ? (
                <button type="button" className="btn btn--linea btn--sm btn--borrar"
                    aria-haspopup="dialog" disabled={disabled} onClick={() => setAbierto(true)}>
                    {texto}
                </button>
            ) : (
                <button type="button" className={`ibtn${chico ? ' ibtn--sm' : ''} ibtn--borrar`}
                    aria-haspopup="dialog" aria-label={etiqueta} title={etiqueta}
                    disabled={disabled} onClick={() => setAbierto(true)}>
                    <Trash2 />
                </button>
            )}
            {abierto && (
                <ModalConfirmacion titulo={titulo} confirmar={confirmar} confirmando={confirmando}
                    onConfirmar={onBorrar} onCerrar={() => setAbierto(false)}>
                    {children}
                </ModalConfirmacion>
            )}
        </>
    );
};

export default BorrarConConfirmacion;
