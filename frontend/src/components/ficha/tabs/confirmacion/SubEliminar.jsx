import React from 'react';
import InlineConfirm from '../../../ui/InlineConfirm';
import { Aviso, SubVista } from '../../piezas';

/**
 * Eliminar el lead. Borra de verdad y no hay endpoint para restaurar, así que la
 * única forma honesta de ofrecer «deshacer» es no haber borrado todavía: eso es lo
 * que hace `InlineConfirm`, que difiere el borrado durante la ventana de deshacer.
 *
 * Nada de `window.confirm`: el diálogo nativo lo dibuja el navegador, se puede
 * bloquear, y cuando no aparece el botón simplemente «no hace nada».
 */
const SubEliminar = ({ ficha, onVolver, onConfirmar }) => {
    const nombre = ficha?.identidad?.nombre || 'este lead';
    return (
        <SubVista titulo="Eliminar lead" onVolver={onVolver}
            acciones={(
                <InlineConfirm
                    tema="oscuro"
                    label="Eliminar lead"
                    question="¿Seguro?"
                    confirmLabel="Sí, eliminar"
                    doneLabel="Eliminado"
                    title={`Eliminar a ${nombre} y todo su historial`}
                    onConfirm={onConfirmar}
                />
            )}>
            <Aviso tono="error" titulo={`Esto borra a ${nombre} y todo su historial. No se puede deshacer.`}>
                Si no va a comprar, usá Descartar lead: queda guardado y podés retomarlo.
            </Aviso>
        </SubVista>
    );
};

export default SubEliminar;
