import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { escalonDe, useVentanaDeEntrada } from './Huesos';

/**
 * La ventana de entrada decide si una fila o tarjeta real espera su turno (`escalonDe`) o entra
 * ya. Tiene que durar lo que tarda en entrar la última de la tanda —si se cierra antes, a esa
 * última se le corta la entrada— y cerrarse después, para que lo que aparezca suelto (una tarjeta
 * que cambió de columna, una fila que vuelve con el buscador) no quede invisible esperando.
 */

// El último retraso posible (el tope) más la entrada de `cardRiseIn` (.34 s en index.css).
const ULTIMA_TERMINA_MS = escalonDe(Infinity) + 340;

describe('useVentanaDeEntrada', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('arranca cerrada: lo que se monta sin una carga de por medio no espera', () => {
        const { result } = renderHook(() => useVentanaDeEntrada());
        expect(result.current[0]).toBe(false);
    });

    it('se abre en el mismo render que la pide y dura hasta que entró la última de la tanda', () => {
        const { result } = renderHook(() => useVentanaDeEntrada());
        act(() => { result.current[1](); });
        expect(result.current[0]).toBe(true);

        act(() => { vi.advanceTimersByTime(ULTIMA_TERMINA_MS); });
        expect(result.current[0]).toBe(true);

        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current[0]).toBe(false);
    });

    it('volver a abrirla la estira desde ahí: una segunda tanda no se corta por la primera', () => {
        const { result } = renderHook(() => useVentanaDeEntrada());
        act(() => { result.current[1](); });
        act(() => { vi.advanceTimersByTime(ULTIMA_TERMINA_MS); });
        act(() => { result.current[1](); });
        act(() => { vi.advanceTimersByTime(ULTIMA_TERMINA_MS); });
        expect(result.current[0]).toBe(true);
    });

    it('`abrir` es estable, así puede ir en las dependencias de un useCallback', () => {
        const { result, rerender } = renderHook(() => useVentanaDeEntrada());
        const abrir = result.current[1];
        act(() => { abrir(); });
        rerender();
        expect(result.current[1]).toBe(abrir);
    });
});
