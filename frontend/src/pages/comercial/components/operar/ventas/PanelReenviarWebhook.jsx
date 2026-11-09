import React from 'react';
import toast from 'react-hot-toast';
import ModalConfirmacion from '../../../../../components/ui/ModalConfirmacion';
import { fmt } from '../../Shared';
import { reenviarWebhook } from './ventasApi';

/**
 * «Reenviar aviso» del «⋯» de una venta (10/10/2026, antes en la tabla vieja de Ventas de
 * Operaciones): vuelve a salir el aviso de la venta en Discord (#wins y, si entra un alumno nuevo, #onboardings).
 *
 * Pide confirmación porque no se deshace: el aviso se publica de nuevo (antes la venta iba a n8n, ADR-W124).
 * La tabla vieja usaba `window.confirm`; acá va el diálogo de la página, que dice el motivo
 * del error adentro y deja reintentar. No recarga la tabla: reenviar no cambia la venta.
 */
const PanelReenviarWebhook = ({ fila, onCerrar }) => {
    const reenviar = async () => {
        try {
            await reenviarWebhook(fila.id);
        } catch (err) {
            // El backend explica el error en `error`; `ModalConfirmacion` lo muestra adentro.
            throw new Error(err?.response?.data?.error || 'No se pudo reenviar el aviso. Probá de nuevo.');
        }
        toast.success('Aviso reenviado a Discord');
    };

    return (
        <ModalConfirmacion titulo="¿Reenviar el aviso de esta venta?" confirmar="Reenviar"
            confirmando="Reenviando…" onConfirmar={reenviar} onCerrar={onCerrar}>
            El aviso de la venta de <b>{fila.cliente}</b> por <b>{fmt.money(fila.monto)}</b> vuelve a salir en Discord.
            Sale como un mensaje nuevo en #wins (y en #onboardings si es un alumno nuevo).
        </ModalConfirmacion>
    );
};

export default PanelReenviarWebhook;
