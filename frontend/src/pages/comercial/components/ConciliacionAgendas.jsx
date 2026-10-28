import React from 'react';
import { Tip } from './Shared';

/**
 * «223 agendas = 150 vigentes + 73 descartadas», con cada cifra como botón que abre esa lista.
 *
 * El embudo de Analizar cuenta todas las agendas del período y Revisar muestra por defecto las vigentes:
 * sin esta línea la diferencia se explicaba en un texto de ayuda (Kerwin, 28/10/2026: que se vea en los
 * números). Las descartadas son las que el lead canceló, el closer marcó como lead perdido o descalificó
 * y las que el sistema archivó sin reporte (`DESCARTADAS` en `comercial_vocabulario.py`).
 */
const Cifra = ({ chip, n, rotulo, chipActivo, elegir }) => (
    <button type="button" className={`pastilla pastilla--sm${chipActivo === chip ? ' pastilla--on' : ''}`}
        aria-pressed={chipActivo === chip} onClick={() => elegir(chip)}>
        <b className="num">{n}</b> {rotulo}
    </button>
);

const ConciliacionAgendas = ({ total, descartadas, chipActivo, elegir }) => (
    <div className="fila" role="group" aria-label="De cuántas agendas se compone la lista"
        style={{ alignItems: 'center', gap: 'var(--s2)', flexWrap: 'wrap', margin: 'var(--s3) 0' }}>
        <Cifra chip="todas_las" n={total} rotulo={total === 1 ? 'agenda' : 'agendas'} chipActivo={chipActivo} elegir={elegir} />
        <span className="mut40" aria-hidden="true">=</span>
        <Cifra chip="todas" n={total - descartadas} rotulo="vigentes" chipActivo={chipActivo} elegir={elegir} />
        <span className="mut40" aria-hidden="true">+</span>
        <Cifra chip="descartadas" n={descartadas} rotulo="descartadas" chipActivo={chipActivo} elegir={elegir} />
        <Tip titulo="Descartadas"
            texto="El lead canceló, el closer la marcó como lead perdido o la descalificó, o el sistema la archivó sin reporte." />
    </div>
);

export default ConciliacionAgendas;
