// Sección 1 · Forms: los recursos que usan los eventos. Formularios (lista o editor del abierto) y
// páginas de gracias (lo que ve el lead después de agendar).

import { useUi } from '../../data/hooks';
import { Seg } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import ListaForms from './ListaForms';
import Editor from './Editor';
import ListaGracias from './ListaGracias';
import EditorGracias from './EditorGracias';

const RECURSOS = [{ v: 'formularios', n: 'Formularios', icono: 'form' }, { v: 'gracias', n: 'Páginas de gracias', icono: 'video' }];

export default function Forms() {
    const { form, gracias, recurso } = useUi();
    if (form) return <Editor key={form.id} />;
    if (gracias) return <EditorGracias key={gracias.id} />;
    return (
        <>
            <div className="barra forms-recurso">
                <Seg nav label="Recursos" valor={recurso} opciones={RECURSOS} onChange={v => ui.set({ recurso: v })} />
            </div>
            {recurso === 'gracias' ? <ListaGracias /> : <ListaForms />}
        </>
    );
}
