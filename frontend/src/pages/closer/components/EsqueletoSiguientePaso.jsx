import { Esqueleto, Hueso, Renglon } from '../../../components/huesos/Huesos';

/**
 * "Tu siguiente paso" mientras el mazo carga por primera vez.
 *
 * Hasta tener los contadores, la tarjeta no tiene con qué elegir: `counts` arranca en cero y el
 * mazo vacío, así que caía en la rama de "🎉 Tenés absolutamente todo el día resuelto". Eso se
 * leía durante toda la carga, justo arriba del esqueleto del kanban que decía lo contrario, y en
 * el día con más trabajo pendiente era la primera frase que veía el closer.
 *
 * Tiene la forma de la tarjeta con un lead, que es lo que suele venir en Confirmar y en Reportar:
 * el rótulo de verdad (no depende de nada), la cuenta regresiva, el nombre y el origen en hueso,
 * y el botón grande al pie. Mide lo mismo que esa tarjeta, 212 px. Sin el fondo rosa de la tarjeta
 * con lead: todavía no hay nada que tocar, así que va con la caja neutra de `tsp-done-v6`, que
 * además no se levanta con el hover.
 */
const EsqueletoSiguientePaso = () => (
    <Esqueleto rotulo="Cargando tu siguiente paso…" className="tsp-v6 tsp-done-v6">
        <div className="tsp-top-v6" aria-hidden="true">
            <span className="tsp-dot-v6"></span>
            <span className="tsp-lbl-v6">Tu siguiente paso</span>
            <div className="flex-1"></div>
            {/* La cuenta regresiva (`.tsp-badge-v6`): 10 px de letra en 15, más 5 + 5 de padding. */}
            <Hueso alto={25} ancho={88} radio={99} />
        </div>
        {/* El nombre (`.tsp-name-v6`): 26 px de letra con interlineado de 1,1. */}
        <Renglon alto={28.6}><Hueso alto={22} ancho="46%" paso={1} /></Renglon>
        {/* El origen y el @ (`.tsp-sub-v6`): 12,5 px de letra en un renglón de 18,75. */}
        <Renglon alto={18.75}><Hueso alto={11} ancho="34%" paso={2} /></Renglon>
        {/* El botón (`.tsp-cta-v6`): 54 px de alto, al pie como el de verdad (`margin-top: auto`). */}
        <Hueso alto={54} radio={99} paso={3} style={{ marginTop: 'auto' }} />
    </Esqueleto>
);

export default EsqueletoSiguientePaso;
