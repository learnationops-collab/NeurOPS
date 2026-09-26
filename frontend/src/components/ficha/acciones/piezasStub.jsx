// Dobles mínimos de las piezas compartidas de `ficha/piezas/`, que las escribe el agente del
// modal. Existen solo para poder desarrollar y testear estas pestañas antes de la integración:
// respetan el contrato de props acordado y nada más. En los tests se inyectan con `vi.mock`.
//
// NO se importan desde los componentes de producción: ahí se importa `../piezas/…`.

export const StepperFicha = ({ pasos = [], onPaso = null }) => (
  <ol data-pieza="stepper">
    {pasos.map((p) => (
      <li key={p.key} data-estado={p.estado}>
        {onPaso ? (
          <button type="button" onClick={() => onPaso(p.key)}>{p.label}</button>
        ) : <span>{p.label}</span>}
        <small>{p.sub}</small>
      </li>
    ))}
  </ol>
);

export const DesplegableAgrupado = ({ grupos = [], valor, multiple = false, onChange, onAgregar }) => (
  <div data-pieza="desplegable">
    {grupos.map((g) => (
      <fieldset key={g.titulo}>
        <legend>{g.titulo}</legend>
        {(g.opciones || []).map((o) => {
          const clave = typeof o === 'string' ? o : o.clave;
          const label = typeof o === 'string' ? o : o.label;
          const activo = multiple ? (valor || []).includes(clave) : valor === clave;
          return (
            <button
              key={clave}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange?.(multiple
                ? (activo ? (valor || []).filter((v) => v !== clave) : [...(valor || []), clave])
                : clave)}
            >
              {label}
            </button>
          );
        })}
        {onAgregar && <button type="button" onClick={() => onAgregar(g.titulo)}>+ Agregar</button>}
      </fieldset>
    ))}
  </div>
);

export const SelectorFecha = ({ valor, onChange, presets = [], minimo }) => (
  <span data-pieza="selector-fecha">
    <input type="date" value={valor || ''} min={minimo || undefined} onChange={(e) => onChange?.(e.target.value)} />
    {presets.map((p) => (
      <button key={p.clave || p} type="button" onClick={() => onChange?.(p.valor)}>{p.label || p}</button>
    ))}
  </span>
);

// `icono` es el COMPONENTE del icono, no el elemento ya construido: la pieza real le pasa
// `size`. El stub tiene que imitar ese contrato o los tests pasan con una forma que en
// produccion explota.
export const TarjetaAccion = ({ tono = 'info', icono: Icono = null, label, onClick }) => (
  <button type="button" data-pieza="tarjeta-accion" data-tono={tono} onClick={onClick}>
    {Icono && <Icono />}
    {label}
  </button>
);

export const SeccionColapsable = ({ titulo, resumen, children }) => (
  <details data-pieza="seccion" open>
    <summary>{titulo}<small>{resumen}</small></summary>
    {children}
  </details>
);

export const SubVista = ({ titulo, onVolver, acciones, children }) => (
  <section data-pieza="subvista">
    <header>
      <button type="button" onClick={onVolver}>Volver</button>
      <h3>{titulo}</h3>
    </header>
    {children}
    <footer>{acciones}</footer>
  </section>
);
