/**
 * Meta Pixel Tracking Service
 * Proporciona una interfaz para disparar eventos estándar y personalizados de Meta.
 */

export const pixelService = {
  /**
   * Dispara un evento de PageView.
   */
  pageView: () => {
    if (window.fbq) {
      window.fbq('track', 'PageView');
    }
  },

  /**
   * Dispara un evento estándar de Meta (e.g., 'Lead', 'Purchase', 'AddToCart').
   * @param {string} eventName - Nombre del evento estándar.
   * @param {Object} params - Datos adicionales para el evento.
   */
  track: (eventName, params = {}) => {
    if (window.fbq) {
      window.fbq('track', eventName, params);
    }
  },

  /**
   * Dispara un evento personalizado.
   * @param {string} eventName - Nombre del evento personalizado.
   * @param {Object} params - Datos adicionales para el evento.
   */
  trackCustom: (eventName, params = {}) => {
    if (window.fbq) {
      window.fbq('trackCustom', eventName, params);
    }
  }
};

export default pixelService;
