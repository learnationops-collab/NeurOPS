import React from 'react';
import { aConfirmar, leerRuta } from './modelo';

// Cómo contó el Inbox cada número: el subtítulo de su lista.
export const REGLAS = {
    entrantes: 'Su primer mensaje llegó ese día y la conversación es tuya.',
    leads: 'De las nuevas, las que contestaron algo (al bot o a vos), sin las in-abribles. Incluye los no leads.',
    no_lead: 'Contestaron y las marcaste «No lead», o el bot dijo que no califican.',
    inabribles: 'Las que pasaste a «In-abrible» desde la tarjeta del lead.',
    embudo: 'Llegaron ese día por primera vez a esa etapa.',
    followups: 'Mensajes tuyos tras 12 h sin respuesta, en la etapa en que estaba la conversación.',
    followups_respondidos: 'De esos follow-ups, los que el lead contestó.',
};

/**
 * La marca del rótulo: «Inbox ›» si el número lo contó el Inbox (abre su lista), «Corregido» si el
 * setter lo cambió, «A confirmar» si todavía no tiene definición. `rutas`: las celdas que cubre.
 */
const Marca = ({ rutas, titulo, ctx }) => {
    const autos = rutas.filter(r => r in ctx.inbox.autos);
    if (!autos.length) {
        return aConfirmar(rutas[0]) ? (
            <span className="rd-marca rd-marca--conf" title="Todavía no tiene definición acordada: lo cargás vos">A confirmar</span>
        ) : null;
    }
    const corregido = autos.some(r => leerRuta(ctx.estado, r) !== ctx.inbox.autos[r]);
    const contado = autos.map(r => ctx.inbox.autos[r]).join(' · ');
    return (
        <button type="button" className={`rd-marca${corregido ? ' rd-marca--corr' : ''}`}
            title={corregido ? `El Inbox contó ${contado}. Tocá para ver la lista` : 'Lo contó el Inbox. Tocá para ver la lista'}
            onClick={() => ctx.verLista(autos, titulo)}>
            {corregido ? `Corregido · era ${contado}` : 'Inbox'} ›
        </button>
    );
};

export default Marca;
