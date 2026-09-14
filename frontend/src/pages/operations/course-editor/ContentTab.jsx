const ContentTab = ({ form, setForm, flatModules }) => (
    <>
        <div className="form-field">
            <label className="form-label" htmlFor="ce-lesson-title">Título</label>
            <input id="ce-lesson-title" className="form-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej: Cómo confirmar agendas - Actualización" />
        </div>

        <div className="form-field">
            <label className="form-label" htmlFor="ce-lesson-desc">Descripción breve (opcional)</label>
            <textarea id="ce-lesson-desc" className="form-textarea" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <p className="form-hint">Una línea. Aparece debajo del título en la lista del alumno.</p>
        </div>

        <div className="form-field">
            <label className="form-label" htmlFor="ce-lesson-module">Módulo</label>
            <select id="ce-lesson-module" className="form-select" value={form.module_id} onChange={(e) => setForm((f) => ({ ...f, module_id: Number(e.target.value) }))}>
                {flatModules.map((m) => (
                    <option key={m.moduleId} value={m.moduleId}>{m.areaName} · {m.moduleName}</option>
                ))}
            </select>
            <p className="form-hint">Cambiarlo mueve la lección a ese módulo al guardar.</p>
        </div>

        <div className="form-row">
            <div className="form-field">
                <label className="form-label" htmlFor="ce-lesson-loom">Link de Loom</label>
                <input id="ce-lesson-loom" className="form-input" value={form.loom_link} onChange={(e) => setForm((f) => ({ ...f, loom_link: e.target.value }))} placeholder="https://www.loom.com/share/..." />
            </div>
            <div className="form-field">
                <label className="form-label" htmlFor="ce-lesson-duration">Duración (min)</label>
                <input id="ce-lesson-duration" type="number" min="0" className="form-input" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} />
            </div>
        </div>

        <div className="form-field">
            <label className="form-label" htmlFor="ce-lesson-transcript">Transcripción (opcional — para el buscador Learnito, próximamente)</label>
            <textarea id="ce-lesson-transcript" className="form-textarea" rows={3} value={form.transcript} onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))} placeholder="Pegá acá la transcripción del video, si la tenés." />
        </div>
    </>
);

export default ContentTab;
