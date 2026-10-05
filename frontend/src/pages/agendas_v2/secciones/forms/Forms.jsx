// Sección 1 · Forms: la lista de formularios o el editor del que está abierto.

import { useUi } from '../../data/hooks';
import ListaForms from './ListaForms';
import Editor from './Editor';

export default function Forms() {
    const { form } = useUi();
    return form ? <Editor key={form.id} /> : <ListaForms />;
}
