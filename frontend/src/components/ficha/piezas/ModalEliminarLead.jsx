import React, { useEffect, useState } from 'react';
import ModalConfirmacion from '../../ui/ModalConfirmacion';
import { ejecutarConsulta, mensajeDeError } from '../fichaApi';

/**
 * La confirmación de eliminar un lead de prueba (03/11/2026): dice QUÉ se borra, con sus pagos si los tiene.
 *
 * Trae `GET /ficha/<agenda>/lead/borrado` y arma la lista. Un lead con plata (pago, venta o cuotas) solo se borra
 * con una confirmación aparte («Eliminar lead, pago y venta») y si el rol puede (`puede_con_plata`); una suscripción
 * frena a todos, y el motivo sale en el mismo diálogo. `eliminar(conPlata)` lo pone quien monta el modal: la ficha
 * usa su `onAccion` y las listas llaman directo a la API.
 */
const dinero = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dia = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const Fila = ({ izquierda, derecha, fuerte = false }) => (
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span>{izquierda}</span>
        <span style={fuerte ? { fontWeight: 700 } : { opacity: 0.8 }}>{derecha}</span>
    </span>
);

const ModalEliminarLead = ({ agendaId, nombre, eliminar, onCerrar }) => {
    const [resumen, setResumen] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let vivo = true;
        ejecutarConsulta('resumen_borrado', agendaId)
            .then((datos) => { if (vivo) setResumen(datos); })
            .catch((e) => { if (vivo) setError(mensajeDeError(e)); });
        return () => { vivo = false; };
    }, [agendaId]);

    const conPlata = !!resumen?.con_plata;
    const confirmar = conPlata ? 'Eliminar lead, pago y venta' : 'Eliminar lead';
    const onConfirmar = async () => {
        if (!resumen) throw new Error(error || 'Todavía se está leyendo lo que se borraría.');
        if (resumen.suscripciones) {
            throw new Error(`Tiene ${plural(resumen.suscripciones, 'suscripción', 'suscripciones')}: antes hay que cerrar su acceso en la Academia.`);
        }
        if (conPlata && !resumen.puede_con_plata) {
            throw new Error('Tiene plata registrada: solo la dirección o el director de marketing pueden eliminarlo.');
        }
        await eliminar(conPlata);
    };

    return (
        <ModalConfirmacion titulo={`Eliminar a ${resumen?.nombre || nombre || 'este lead'}`} confirmar={confirmar}
            onConfirmar={onConfirmar} onCerrar={onCerrar}>
            {!resumen ? (
                <span>{error || 'Leyendo lo que se borraría…'}</span>
            ) : (
                <>
                    <span>
                        {conPlata
                            ? 'Tiene plata registrada. Si es un lead de prueba, también se borra su pago y su venta.'
                            : 'Se borran el lead, sus agendas y su conversación, así deja de contar en Marketing y en Revisar.'}
                    </span>
                    {resumen.pagos.map((p) => (
                        <Fila key={p.id} izquierda={`Pago${p.tipo ? ` · ${p.tipo}` : ''}${p.medio ? ` · ${p.medio}` : ''}`}
                            derecha={`${dinero(p.monto)} · ${dia(p.fecha)}`} fuerte />
                    ))}
                    {resumen.ventas > 0 && <Fila izquierda="Ventas" derecha={resumen.ventas} />}
                    {resumen.planes > 0 && <Fila izquierda="Cuotas del plan" derecha={resumen.planes} />}
                    <Fila izquierda="Agendas" derecha={resumen.agendas} />
                    {resumen.conversaciones > 0 && <Fila izquierda="Conversaciones de Instagram" derecha={resumen.conversaciones} />}
                    {resumen.suscripciones > 0 && (
                        <span role="alert">
                            Tiene {plural(resumen.suscripciones, 'suscripción', 'suscripciones')}: no se puede eliminar hasta cerrar su
                            acceso en la Academia.
                        </span>
                    )}
                    {conPlata && !resumen.puede_con_plata && (
                        <span role="alert">Solo la dirección o el director de marketing pueden eliminar un lead con plata.</span>
                    )}
                    <span>No se puede deshacer.{conPlata ? ' Finanzas y comisiones dejan de contar ese pago.' : ''}</span>
                </>
            )}
        </ModalConfirmacion>
    );
};

export default ModalEliminarLead;
