// Ventanas del editor: importar preguntas de otro formulario y la pantalla de "No califica".

import { useState } from 'react';
import { tipo } from '../../core/catalogos';
import { ord } from '../../core/datos';
import { copiarPregunta, personalizar } from '../../core/formulario';
import { Humo, Icono, Modal, Sx } from '../../ui/base';
import { toast } from '../../ui/toast';
import { TituloConToken, mutarForm, useBorrador } from './comun';

export function fuentesImport(d, fid) { return ord(d, 'formularios').filter(x => x.id !== fid && x.preguntas.length); }

export function ModalImportar({ f, d, onCerrar, onImportado }) {
    const fs = fuentesImport(d, f.id);
    const [fuente, setFuente] = useState(fs[0] ? fs[0].id : '');
    const [sel, setSel] = useState({});
    const fo = fs.find(x => x.id === fuente) || fs[0];
    if (!fo) return null;
    const n = fo.preguntas.filter(q => sel[q.id]).length;
    const todas = () => { const t = fo.preguntas.every(q => sel[q.id]); setSel(Object.fromEntries(fo.preguntas.map(q => [q.id, !t]))); };
    const importar = () => {
        const copias = fo.preguntas.filter(q => sel[q.id]).map(copiarPregunta);
        if (!copias.length) return;
        mutarForm(f.id, 'preguntas', ps => ps.concat(copias));
        onImportado(copias[0].id);
        toast(copias.length + ' importadas');
    };
    return (
        <Modal onCerrar={onCerrar} style={{ width: 'min(760px,100%)' }} labelledBy="imp-tit">
            <div className="modal-cab">
                <span className="icono-m"><Icono n="importar" s={19} /></span>
                <div className="modal-tit"><h2 className="t-h2" id="imp-tit">Importar preguntas</h2></div>
                <button type="button" className="ibtn" data-nav="" aria-label="Cerrar" onClick={onCerrar}><Icono n="x" /></button>
            </div>
            <div className="barra" style={{ marginBottom: 12 }}>
                <Sx id="imp-f" label="Formulario" valor={fo.id} opciones={fs.map(x => ({ v: x.id, n: x.nombre + ' · ' + x.preguntas.length }))}
                    onChange={v => { setFuente(v); setSel({}); }} />
                <button type="button" className="btn btn--linea btn--sm" onClick={todas}>Todas</button>
            </div>
            <div className="lista" style={{ maxHeight: 'min(50vh,440px)', overflow: 'auto' }}>
                {fo.preguntas.map(q => {
                    const on = !!sel[q.id];
                    return (
                        <button key={q.id} type="button" className="ct-fila" role="checkbox" aria-checked={on}
                            style={{ width: '100%', textAlign: 'left', ...(on ? { background: 'var(--brand-secondary-surface)' } : {}) }}
                            onClick={() => setSel(s => ({ ...s, [q.id]: !s[q.id] }))}>
                            <span className="switch" aria-hidden="true" style={{ pointerEvents: 'none' }} aria-checked={on} />
                            <b><TituloConToken t={q.titulo} /></b>
                            <span className="chip chip--n" style={{ '--c': 'var(--idle)' }}>{tipo(q.tipo).n}</span>
                        </button>
                    );
                })}
            </div>
            <div className="barra" style={{ marginTop: 16 }}>
                <span className="t-sm mut">{n ? n + ' seleccionadas' : 'Elegí preguntas'}</span>
                <div className="barra-der">
                    <button type="button" className="btn btn--linea" data-nav="" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className="btn btn--cta" disabled={!n} onClick={importar}><Icono n="importar" />Importar{n ? ' ' + n : ''}</button>
                </div>
            </div>
        </Modal>
    );
}

// Pantalla para quien no califica: título y texto, con la vista previa al lado (con "Ana" de ejemplo).
export function ModalNoCalifica({ f, onCerrar }) {
    const guardar = (k) => (v) => mutarForm(f.id, 'fin', fin => { fin[k] = v; });
    const titulo = useBorrador(f.fin.titulo, guardar('titulo'));
    const texto = useBorrador(f.fin.texto, guardar('texto'));
    return (
        <Modal onCerrar={onCerrar} clase="modal--fin" labelledBy="fin-tit">
            <Humo clase="humo--tarjeta humo--suave" cols={['var(--error)', 'var(--brand-primary)', 'var(--brand-secondary)', 'var(--brand-navy)']} />
            <div className="modal-cab">
                <span className="fin-ico"><Icono n="prohibido" s={18} /></span>
                <h2 className="t-h3" id="fin-tit" style={{ flex: 1 }}>Si no califica</h2>
                <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label="Cerrar" onClick={onCerrar}><Icono n="x" /></button>
            </div>
            <div className="fin-grid">
                <div className="fin-campos">
                    <label className="t-rotulo" htmlFor="fin-titulo">Título</label>
                    <input className="input" id="fin-titulo" maxLength={120} {...titulo} />
                    <label className="t-rotulo" htmlFor="fin-texto">Texto</label>
                    <textarea className="input fin-area" id="fin-texto" maxLength={300} rows={3} {...texto} />
                    <p className="t-cap mut40">Usá {'{nombre}'} para el nombre del lead.</p>
                </div>
                <div className="fin-prev" aria-label="Vista previa">
                    <span className="rv-listo-ico rv-listo-ico--no"><Icono n="prohibido" s={24} /></span>
                    <b>{personalizar(titulo.value, 'Ana')}</b>
                    <span>{personalizar(texto.value, 'Ana')}</span>
                </div>
            </div>
        </Modal>
    );
}
