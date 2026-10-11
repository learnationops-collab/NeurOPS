import React from 'react';
import toast from 'react-hot-toast';
import ModalConfirmacion from '../../../../../components/ui/ModalConfirmacion';
import { fmt } from '../../Shared';
import { reenviarWebhook } from './ventasApi';

/**
 * «Reenviar webhook» del «⋯» de una venta (10/10/2026, antes en la tabla vieja de Ventas de
 * Operaciones): la venta vuelve a salir hacia n8n como si recién se hubiera cargado.
 *
 * Pide confirmación porque no se deshace: lo que n8n haga con ella —escribir la planilla, avisar— se
 * repite. La tabla vieja usaba `window.confirm`; acá va el diálogo de la página, que dice el motivo
 * del error adentro y deja reintentar. No recarga la tabla: reenviar no cambia la venta.
 */
const PanelReenviarWebhook = ({ fila, onCerrar }) => {
    const reenviar = async () => {
        try {
            await reenviarWebhook(fila.id);
        } catch (err) {
            // El backend explica el error en `error`; `ModalConfirmacion` lo muestra adentro.
            throw new Error(err?.response?.data?.error || 'No se pudo reenviar el webhook. Probá de nuevo.');
        }
        toast.success('Webhook reenviado a n8n');
    };

    return (
        <ModalConfirmacion titulo="¿Reenviar el webhook de esta venta?" confirmar="Reenviar"
            confirmando="Reenviando…" onConfirmar={reenviar} onCerrar={onCerrar}>
            La venta de <b>{fila.cliente}</b> por <b>{fmt.money(fila.monto)}</b> vuelve a salir hacia n8n.
            Lo que n8n hace con una venta nueva —la planilla, los avisos— se repite.
        </ModalConfirmacion>
    );
};

export default PanelReenviarWebhook;
