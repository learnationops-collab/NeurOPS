// Bus de eventos minimo para disparar el widget de reporte de bugs desde
// cualquier punto de la app (ErrorBoundary, interceptor de axios, etc.)
// sin acoplar esos módulos al componente del widget.
export const BUG_REPORT_EVENT = 'neurops:open-bug-report';

// context: { message, status, url, method, stack, autoOpen }
export function triggerBugReport(context = {}) {
    window.dispatchEvent(new CustomEvent(BUG_REPORT_EVENT, { detail: context }));
}
