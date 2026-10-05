// Editor de la descripción: negrita, cursiva, subrayado, listas, link, deshacer y rehacer.
// Es un contenteditable con execCommand, como el prototipo; lo que se guarda pasa siempre por limpiarHTML.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { limpiarHTML, urlOk } from '../../core/normalizar';
import { esc } from '../../core/util';
import { almacen } from '../../data/hooks';
import { Icono } from '../../ui/base';

const BOTONES = [
    ['bold', <b key="b">B</b>, 'Negrita'], ['italic', <i key="i">I</i>, 'Cursiva'], ['underline', <u key="u">U</u>, 'Subrayado'], 0,
    ['insertUnorderedList', <Icono key="l1" n="lbul" />, 'Viñetas'], ['insertOrderedList', <Icono key="l2" n="lnum" />, 'Lista numerada'], ['link', <Icono key="lk" n="link" />, 'Link'], 0,
    ['undo', <Icono key="un" n="deshacer" />, 'Deshacer'], ['redo', <Icono key="re" n="rehacer" />, 'Rehacer'],
];

export default function EditorDescripcion({ e }) {
    const ed = useRef(null), url = useRef(null), rango = useRef(null);
    const [linkAbierto, setLinkAbierto] = useState(false);
    const [urlMal, setUrlMal] = useState(false);

    // El HTML se pone a mano: React no maneja el contenido del contenteditable. Solo se pisa cuando el
    // valor guardado cambió por fuera (deshacer, descartar) y no coincide con lo que ya se ve.
    useLayoutEffect(() => {
        const el = ed.current;
        if (el && limpiarHTML(el.innerHTML) !== e.desc) el.innerHTML = e.desc;
    }, [e.desc]);

    useEffect(() => { if (linkAbierto && url.current) url.current.focus(); }, [linkAbierto]);

    const guardar = () => { if (ed.current) almacen.editar('eventos', e.id, { desc: limpiarHTML(ed.current.innerHTML) }); };

    const comando = (cmd) => {
        const el = ed.current;
        if (!el) return;
        if (cmd === 'link') {
            const sel = window.getSelection();
            rango.current = sel.rangeCount && el.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
            setLinkAbierto(a => !a);
            setUrlMal(false);
            return;
        }
        el.focus();
        try { document.execCommand('styleWithCSS', false, false); document.execCommand(cmd, false, null); } catch { /* navegador sin execCommand */ }
        guardar();
    };

    const ponerLink = () => {
        const el = ed.current, v = (url.current.value || '').trim();
        const u = urlOk(v) || (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v) ? 'https://' + v : '');
        if (!u) { setUrlMal(true); url.current.focus(); return; }
        el.focus();
        const sel = window.getSelection();
        if (rango.current) { sel.removeAllRanges(); sel.addRange(rango.current); }
        try {
            if (sel.isCollapsed || !rango.current) document.execCommand('insertHTML', false, '<a href="' + esc(u) + '">' + esc(u) + '</a>');
            else document.execCommand('createLink', false, u);
        } catch { /* navegador sin execCommand */ }
        url.current.value = '';
        rango.current = null;
        setLinkAbierto(false);
        guardar();
    };

    return (
        <div className="rte">
            <div className="rte-barra" role="toolbar" aria-label="Formato">
                {BOTONES.map((x, i) => x
                    ? <button key={x[0]} type="button" className="rte-b" aria-label={x[2]} title={x[2]} aria-expanded={x[0] === 'link' ? linkAbierto : undefined}
                        onMouseDown={ev => ev.preventDefault()} onClick={() => comando(x[0])}>{x[1]}</button>
                    : <i key={'s' + i} className="rte-sep" aria-hidden="true" />)}
            </div>
            <div className="rte-link" hidden={!linkAbierto}>
                <input ref={url} className={'input' + (urlMal ? ' mal' : '')} type="url" placeholder="https://…" aria-label="Dirección del link"
                    onChange={() => { if (urlMal) setUrlMal(false); }}
                    onKeyDown={ev => {
                        if (ev.key === 'Enter') { ev.preventDefault(); ponerLink(); }
                        else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); setLinkAbierto(false); }
                    }} />
                <button type="button" className="btn btn--cta btn--sm" onClick={ponerLink}>Poner</button>
            </div>
            <div ref={ed} className="rte-texto" id="ev-desc" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
                aria-label="Descripción" data-ph="Qué va a pasar en la llamada" onInput={guardar} onBlur={() => almacen.flush()} />
        </div>
    );
}
