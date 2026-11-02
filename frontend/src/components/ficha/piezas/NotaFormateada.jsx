import React from 'react';
import './nota-formateada.css';

/**
 * Una nota escrita a mano o pegada de otro lado (la del triage, los mensajes del hilo) con el
 * formato que casi siempre trae: títulos en mayúsculas («DIRECCIÓN»), viñetas con `*` o `-` pegadas
 * al texto, «Etiqueta: texto» y restos de `**`. No es markdown completo a propósito: lo que no se
 * reconoce se deja como párrafo, nunca se esconde texto.
 */

const MAYUSCULAS = /^[A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9 /&,.()\-·:]*$/;
const VINETA = /^(\s*)([*•\-–]|\d+[.)])\s*(?=\S)/;

// `**negrita**` (y `*cursiva*` suelta); los `**` que no cierran se descartan.
function enLinea(texto, clave) {
    const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return partes.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={`${clave}${i}`}>{p.slice(2, -2)}</strong>;
        return p.replace(/\*\*/g, '');
    });
}

// «Etiqueta: resto» → etiqueta en negrita (solo si es corta: no es una frase con dos puntos).
function conEtiqueta(texto, clave) {
    const limpio = texto.replace(/^\*\*|\*\*$/g, '');
    const m = limpio.match(/^([^:.]{3,70}):\**\s+(\S.*)$/);
    if (!m) return enLinea(texto, clave);
    return [<strong key={`${clave}e`} className="nota-fmt__et">{enLinea(m[1], `${clave}t`)}:</strong>, ' ', ...enLinea(m[2], `${clave}r`)];
}

export function bloquesDeNota(texto) {
    const out = [];
    for (const cruda of String(texto || '').replace(/\r/g, '').split('\n')) {
        if (!cruda.trim()) continue;
        const sinMarca = cruda.trim().replace(/^#{1,4}\s+/, '').replace(/^\*\*(.+?)\*\*:?$/, '$1').replace(/\*+$/, '').replace(/:$/, '').trim();
        const esEncabezado = /^#{1,4}\s/.test(cruda.trim()) || /^\*\*[^*]+\*\*:?$/.test(cruda.trim());
        const soloLetras = sinMarca.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
        if (!VINETA.test(cruda) && (esEncabezado || (soloLetras.length >= 3 && sinMarca.length <= 60 && MAYUSCULAS.test(sinMarca)))) {
            out.push({ tipo: 'titulo', texto: sinMarca });
            continue;
        }
        // `*texto*` entero es cursiva, no una viñeta.
        const cursiva = /^\s*\*[^*\s][^*]*\*\s*$/.test(cruda);
        const v = !cursiva && cruda.match(VINETA);
        if (v) {
            const nivel = v[1].replace(/\t/g, '    ').length >= 3 ? 1 : 0;
            out.push({ tipo: 'item', nivel, texto: cruda.slice(v[0].length).trim() });
            continue;
        }
        // Una línea que termina en «:» y es corta abre un grupo («Contexto del estudio (…):»).
        const t = cruda.trim();
        if (t.endsWith(':') && t.length <= 80) out.push({ tipo: 'sub', texto: t.slice(0, -1) });
        else out.push({ tipo: 'p', texto: t });
    }
    return out;
}

/** ¿Tiene títulos, grupos o viñetas? Un mensaje corto de una o dos líneas no: se deja como está. */
export const esEstructurada = (texto) => {
    const b = bloquesDeNota(texto);
    return b.length >= 3 && b.some((x) => x.tipo !== 'p');
};

export default function NotaFormateada({ texto, className = '' }) {
    return (
        <div className={`nota-fmt ${className}`.trim()}>
            {bloquesDeNota(texto).map((b, i) => {
                const k = `n${i}`;
                if (b.tipo === 'titulo') return <h4 key={k} className="nota-fmt__tit">{enLinea(b.texto, k)}</h4>;
                if (b.tipo === 'sub') return <p key={k} className="nota-fmt__sub">{enLinea(b.texto, k)}</p>;
                if (b.tipo === 'item') {
                    return (
                        <div key={k} className={`nota-fmt__li nota-fmt__li--${b.nivel}`}>
                            <i aria-hidden="true" />
                            <span>{conEtiqueta(b.texto, k)}</span>
                        </div>
                    );
                }
                return <p key={k} className="nota-fmt__p">{conEtiqueta(b.texto, k)}</p>;
            })}
        </div>
    );
}
