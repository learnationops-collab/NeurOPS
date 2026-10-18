// Barras simples: un embudo por paso o una serie corta, sin ejes. Las barras crecen al montar.
// variant: columns (una columna por valor, sin rótulos: el mini-embudo de una tarjeta) · rows (una fila
// por valor con rótulo, barra, número y detalle). scale: linear · sqrt (de 600 a 3 la última no queda
// en una raya). El largo es relativo al mayor valor; cero no dibuja barra.

import clsx from 'clsx';
import './standard.css';

function largo(valor, mayor, scale) {
    if (!(valor > 0) || !(mayor > 0)) return 0;
    const r = Math.min(1, valor / mayor);
    return Math.max(4, (scale === 'sqrt' ? Math.sqrt(r) : r) * 100);
}

// items: [{key, value, label, display (el número como se lee), detail, color, tip, disabled, title}]
// onSelect(key): cada columna, o cada fila en `rows`, pasa a ser un botón (`disabled` lo saca a esa fila).
export function Bars({ items, variant = 'columns', scale = 'linear', label, onSelect, className, ...rest }) {
    const mayor = Math.max(0, ...items.map((x) => Number(x.value) || 0));
    return (
        <div className={clsx('ui-bars', 'ui-bars--' + variant, className)} role="list" aria-label={label} {...rest}>
            {items.map((x, i) => {
                const pct = largo(x.value, mayor, scale);
                const estilo = { '--ui-bar': `${pct}%`, '--ui-bar-c': x.color, '--ui-bar-i': i };
                const texto = x.display ?? x.value;
                if (variant === 'rows') {
                    // Con onSelect la fila es un botón (salvo `disabled`): lleva a la lista que compone el número.
                    const fila = onSelect && !x.disabled;
                    const Fila = fila ? 'button' : 'div';
                    return (
                        <Fila key={x.key} className="ui-bars__row" role="listitem" data-tip={x.tip}
                            {...(fila ? { type: 'button', onClick: () => onSelect(x.key), title: x.title } : null)}>
                            <small>{x.label}</small>
                            <span className="ui-bars__track" aria-hidden="true">{pct > 0 && <i style={estilo} />}</span>
                            <b>{texto}</b>
                            <span>{x.detail}</span>
                        </Fila>
                    );
                }
                const Tag = onSelect ? 'button' : 'span';
                return (
                    <Tag key={x.key} role="listitem" className="ui-bars__col" style={estilo} data-tip={x.tip}
                        aria-label={x.label != null ? `${x.label}: ${texto}` : String(texto)}
                        {...(onSelect ? { type: 'button', onClick: () => onSelect(x.key) } : null)}>
                        {pct > 0 && <i />}
                    </Tag>
                );
            })}
        </div>
    );
}
