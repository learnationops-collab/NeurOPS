import { Link2, Pencil, Send } from 'lucide-react';
import PanelAtribuir from './PanelAtribuir';
import PanelEditarLote from './PanelEditarLote';
import PanelReenviarWebhook from './PanelReenviarWebhook';

/**
 * Lo que Operaciones hace sobre las ventas desde Revisar (10/10/2026): lo que solo hacía la tabla
 * vieja de Ventas (`PublicFinancialSalesPage`), con sus mismos endpoints. Se registra en `MODULOS`
 * (`../operacion.js`), así que solo lo ve quien opera (admin y operador).
 *
 * Las filas de quien opera traen `tiene_agenda` (ver `ComercialService._para_operar`): «Atribuir a
 * una agenda» se ofrece solo en las que no tienen, como el «Sin agenda» de la tabla vieja.
 */

export const ATRIBUIR = {
    id: 'ventas.atribuir', label: 'Atribuir a una agenda', Icono: Link2, Panel: PanelAtribuir,
};
export const REENVIAR_WEBHOOK = {
    id: 'ventas.reenviar_webhook', label: 'Reenviar webhook', Icono: Send, Panel: PanelReenviarWebhook,
};
export const EDITAR_EN_LOTE = {
    id: 'ventas.editar_lote', label: 'Editar en lote', Icono: Pencil, Panel: PanelEditarLote,
};

export default {
    ventas: {
        lote: [EDITAR_EN_LOTE],
        fila: (fila) => [...(fila.tiene_agenda === false ? [ATRIBUIR] : []), REENVIAR_WEBHOOK],
    },
};
