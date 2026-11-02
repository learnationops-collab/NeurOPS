import { useRef } from 'react';

/**
 * Paneles de una pantalla con secciones o pestañas: el que se abre por primera vez se monta, y al
 * cambiar a otro NO se desmonta, se esconde. Volver a él lo muestra tal como estaba (con lo que ya
 * había cargado y lo que tenía escrito), sin pedir nada de nuevo.
 *
 * Para las pantallas cuyos paneles cargan solos al montarse (Operaciones, Contratación): en vez de
 * recordar los datos de cada uno, se recuerda el panel entero. A cambio, lo que muestra no se
 * actualiza hasta recargar la página.
 *
 * `paneles`: { clave: () => elemento } — la función solo se llama si el panel ya se visitó.
 */
export default function PanelesConservados({ activa, paneles }) {
    const visitadas = useRef(new Set());
    if (paneles[activa]) visitadas.current.add(activa);
    return (
        <>
            {Object.keys(paneles).filter((clave) => visitadas.current.has(clave)).map((clave) => (
                <div key={clave} hidden={clave !== activa} style={clave === activa ? undefined : { display: 'none' }}>
                    {paneles[clave]()}
                </div>
            ))}
        </>
    );
}
