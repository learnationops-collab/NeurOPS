// «Tus números»: KPIs, embudo, bloques por tipo, tasas y logros. Se dibuja (y anima) al verse.
import { useRef } from 'react';
import clsx from 'clsx';
import { AnimCtx, useAlVerse, useListo } from './animar';
import { CabCard } from './piezas';
import Kpis from './bloques/Kpis';
import Embudo from './bloques/Embudo';
import Comparar from './bloques/Comparar';
import Mix from './bloques/Mix';
import Pasos from './bloques/Pasos';
import Cifras, { ListaCifras } from './bloques/Cifras';
import Tasas from './bloques/Tasas';
import { sinCargar } from './bloques/comun';

const BLOQUE = { comparar: Comparar, mix: Mix, pasos: Pasos, cifras: Cifras };

function Vacio({ b, onIrPendientes }) {
    return (
        <>
            <h4>{b.tit}<em className="rp-tag-m">a mano</em></h4>
            <div className="rp-bl-vacio">
                <span>Todavía no cargaste estos datos.</span>
                <button type="button" className="rp-otra" onClick={onIrPendientes}>Cargarlos en «Antes de que se cierre»</button>
            </div>
        </>
    );
}

function Contenido({ numeros, fecha, corrigiendo, onCorregir, editar, onIrPendientes }) {
    const bloques = numeros.bloques || [];
    const enEmbudo = bloques.filter((b) => b.en_embudo && b.t === 'cifras');
    const resto = bloques.filter((b) => !(b.en_embudo && b.t === 'cifras'));
    const tasas = numeros.tasas || [], logros = numeros.logros || [];
    return (
        <>
            {numeros.kpis?.length > 0 && <Kpis kpis={numeros.kpis} fecha={fecha} />}
            <div className="rp-bloques">
                {(numeros.embudo || enEmbudo.length > 0) && (
                    <div className="rp-caja">
                        <Embudo embudo={numeros.embudo} fecha={fecha}>
                            {enEmbudo.map((b) => <ListaCifras key={b.tit} items={b.items} fecha={fecha} chicas={!!numeros.embudo} />)}
                        </Embudo>
                    </div>
                )}
                {resto.map((b, k) => {
                    const d = 250 + k * 90, Bloque = BLOQUE[b.t];
                    if (!Bloque) return null;
                    const full = b.t === 'pasos' && (b.series || []).length > 1;
                    return (
                        <div key={`${b.t}-${b.tit}`} className={clsx('rp-caja', `bl-${b.t}`, full && 'full')} style={{ animationDelay: `${d}ms` }}>
                            {sinCargar(b)
                                ? <Vacio b={b} onIrPendientes={onIrPendientes} />
                                : <Bloque b={b} d={d} fecha={fecha} editando={corrigiendo === b.tit} onEditar={editar}
                                    onCorregir={() => onCorregir(corrigiendo === b.tit ? null : b.tit)} />}
                        </div>
                    );
                })}
                {(tasas.length > 0 || logros.length > 0) && (
                    <div className={clsx('rp-caja', (tasas.length > 4 || logros.length > 0) && 'full')} style={{ animationDelay: `${300 + bloques.length * 90}ms` }}>
                        <Tasas tasas={tasas} logros={logros} fecha={fecha} />
                    </div>
                )}
            </div>
        </>
    );
}

export default function Numeros({ numeros, fecha, ...rest }) {
    const ref = useRef(null);
    const visto = useAlVerse(ref);
    const listo = useListo(visto);
    return (
        <section className="rp-card ui-panel" id="rp-c-num">
            <CabCard n={3} titulo="Tus números" ok><small>{numeros?.fuente}</small></CabCard>
            <div ref={ref} className="rp-numeros">
                {visto && numeros && (
                    <AnimCtx.Provider value={listo}>
                        <Contenido numeros={numeros} fecha={fecha} {...rest} />
                    </AnimCtx.Provider>
                )}
            </div>
        </section>
    );
}
