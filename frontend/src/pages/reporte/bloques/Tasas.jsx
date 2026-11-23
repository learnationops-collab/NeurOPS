// Tasas del día en anillos, con los logros debajo.
import { Medal } from 'lucide-react';
import Exp from '../Exp';
import { Anillo } from '../piezas';

export default function Tasas({ tasas = [], logros = [], fecha }) {
    return (
        <>
            <h4>Tasas del día</h4>
            <div className="rp-tasas">
                {tasas.map((t, k) => (
                    <Exp key={t.clave || t.l} className="rp-tasa" dato={{ clave: t.clave, l: t.l, v: t.v, f: '%', fecha }}>
                        <Anillo pct={t.v} k={k} /><span>{t.l}</span>
                    </Exp>
                ))}
            </div>
            {logros.length > 0 && (
                <div className="rp-logros">
                    {logros.map((g, k) => (
                        <div key={g.l} className={`rp-logro ${g.si ? 'si' : ''}`} style={{ animationDelay: `${900 + k * 150}ms` }}>
                            <span className="med"><Medal size={18} /></span><span>{g.l}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
