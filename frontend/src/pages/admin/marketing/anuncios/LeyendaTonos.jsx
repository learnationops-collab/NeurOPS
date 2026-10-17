import { MINIMO_DE_LEADS, UMBRAL } from './tonos';

/** Qué quieren decir los colores de la tabla y de las tarjetas (`tonos.js`). */
const LeyendaTonos = () => (
    <p className="mk-leyenda-tonos t-cap" aria-label="Leyenda de colores">
        <span><i className="mk-tono-punto mk-tono-punto--bien" aria-hidden="true" />Mejor que el promedio de la tabla</span>
        <span><i className="mk-tono-punto mk-tono-punto--mal" aria-hidden="true" />Peor</span>
        <span className="mut40">
            {`Sin color: a menos de ${Math.round(UMBRAL * 100)}%. Los porcentajes y costos por lead, desde ${MINIMO_DE_LEADS} leads.`}
        </span>
    </p>
);

export default LeyendaTonos;
