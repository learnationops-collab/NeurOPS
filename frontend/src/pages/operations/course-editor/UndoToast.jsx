// Contenido para toast.custom() de react-hot-toast -- no hace falta un
// componente de toast nuevo desde cero, ya es dependencia del proyecto.
const UndoToast = ({ message, onUndo, onDismiss }) => (
    <div className="ce-shell">
        <div className="undo-toast">
            <span>{message}</span>
            <button type="button" onClick={() => { onUndo(); onDismiss(); }}>Deshacer</button>
        </div>
    </div>
);

export default UndoToast;
