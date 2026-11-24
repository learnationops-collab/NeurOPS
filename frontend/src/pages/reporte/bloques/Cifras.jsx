// Bloque «cifras»: números sueltos. `chicas` las dibuja dentro de la tarjeta del embudo.
import clsx from 'clsx';
import Exp from '../Exp';
import { Cuenta } from '../animar';

export function ListaCifras({ items, fecha, chicas = false }) {
    return (
        <div className={clsx('rp-cifras', chicas && 'chicas')}>
            {(items || []).map((it, k) => (
                <Exp key={it.clave || it.l} className="rp-cifra" dato={{ clave: it.clave, l: it.l, v: it.v, f: it.f, mano: it.mano, fecha }}>
                    <b><Cuenta v={it.v} f={it.f} delay={k * 40} />{it.suf && <small> {it.suf}</small>}</b>
                    <span>{it.l}</span>
                    {it.mano && <em className="rp-tag-m">a mano</em>}
                </Exp>
            ))}
        </div>
    );
}

export default function Cifras({ b, fecha }) {
    return (
        <>
            <h4>{b.tit}</h4>
            <ListaCifras items={b.items} fecha={fecha} />
        </>
    );
}
