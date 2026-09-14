// Aplana el arbol de /playbook/admin/overview en una lista { areaName, moduleId,
// moduleName, lessonCount } -- alimenta el modal de mover (agrupado por area) sin
// que cada consumidor tenga que recorrer roadmaps/modules a mano.
export function flattenModules(overview) {
    const out = [];
    (overview?.roadmaps || []).forEach((roadmap) => {
        (roadmap.modules || []).forEach((module) => {
            out.push({
                areaId: roadmap.id,
                areaName: roadmap.name,
                moduleId: module.id,
                moduleName: module.name,
                lessonIds: (module.lessons || []).map((l) => l.id),
            });
        });
    });
    return out;
}

// idle/warning/success segun los umbrales del mockup: <33 idle, 33-65 warning, >=66 success.
export function chipTone(pct) {
    if (pct >= 66) return 'success';
    if (pct >= 33) return 'warning';
    return 'idle';
}
