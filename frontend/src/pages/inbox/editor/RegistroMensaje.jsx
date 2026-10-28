// «Para Marketing»: qué mensaje del catálogo de Conversaciones es este paso, si califica y en qué etapa
// deja a la persona. Es lo que hoy manda ManyChat por webhook; el motor lo escribe en las mismas tablas
// (app/automatizaciones/registro.py), solo para lo que entra por una campaña.
import { useEffect, useState } from 'react';
import { Input, Select } from '../../../components/standard';
import { inboxApi } from '../api';
import { Campo } from './paneles';

const CALIFICA = [{ value: '', label: 'Según la rama del mensaje' }, { value: 'si', label: 'Califica' }, { value: 'no', label: 'No califica' }];
const RAMA = { calificados: 'rama de calificados', descalificados: 'rama de descalificados' };

let catalogo = null; // una sola carga por sesión: el catálogo cambia poco
function useCatalogo() {
    const [mensajes, setMensajes] = useState(catalogo || []);
    useEffect(() => {
        if (catalogo) return;
        inboxApi.catalogo().then((m) => { catalogo = m; setMensajes(m); }).catch(() => setMensajes([]));
    }, []);
    return mensajes;
}

export default function RegistroMensaje({ nodo, cambiar, lectura }) {
    const mensajes = useCatalogo();
    const registro = nodo.registro || null;
    const poner = (cambio) => {
        const { registro: _r, ...resto } = nodo;
        const nuevo = { ...(registro || {}), ...cambio };
        Object.keys(nuevo).forEach((k) => nuevo[k] === undefined && delete nuevo[k]);
        cambiar(nuevo.mensaje_id ? { ...resto, registro: nuevo } : resto, true);
    };
    const elegido = mensajes.find((m) => m.id === registro?.mensaje_id);
    const opciones = [{ value: '', label: 'No registra' },
        ...mensajes.map((m) => ({ value: m.id, label: `${m.id} · ${m.titulo}${m.activo ? '' : ' (inactivo)'}` }))];
    if (registro?.mensaje_id && !elegido) opciones.push({ value: registro.mensaje_id, label: `${registro.mensaje_id} · (no está en el catálogo)` });
    const califica = registro?.califica === true ? 'si' : registro?.califica === false ? 'no' : '';

    return (
        <div className="pf-bloque">
            <Campo label="Para Marketing" ayuda="El mensaje del catálogo de Conversaciones. Cuenta en Palabras clave y Entrantes cuando la persona entra por una campaña.">
                <Select label="Mensaje del catálogo" value={registro?.mensaje_id || ''} options={opciones} disabled={lectura}
                    onChange={(v) => poner({ mensaje_id: v || undefined })} />
            </Campo>
            {registro?.mensaje_id && (
                <div className="pf-fila">
                    <Select label="Calificación" value={califica} options={CALIFICA} disabled={lectura}
                        onChange={(v) => poner({ califica: v === '' ? undefined : v === 'si' })} />
                    <Input variant="number" type="number" min={0} value={registro.etapa ?? ''} disabled={lectura} aria-label="Etapa al enviarlo" placeholder="Al enviar"
                        data-tip="Etapa al enviarlo|La etapa en que queda la persona cuando le llega este mensaje."
                        onChange={(e) => poner({ etapa: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <Input variant="number" type="number" min={0} value={registro.etapa_respuesta ?? ''} disabled={lectura} aria-label="Etapa al responderlo" placeholder="Al responder"
                        data-tip="Etapa al responderlo|La etapa en que queda cuando lo responde (botón o texto), como en ManyChat."
                        onChange={(e) => poner({ etapa_respuesta: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
            )}
            {registro?.mensaje_id && califica === '' && elegido?.rama && (
                <span className="pf-ayuda">Sin dato propio, toma la {RAMA[elegido.rama]}.</span>
            )}
        </div>
    );
}
