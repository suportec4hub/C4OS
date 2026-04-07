/**
 * Analytics — Meta Pixel + GA4 + Meta Conversions API
 * Injectado automaticamente via Shell quando empresa tem config salva.
 */

export function injectMetaPixel(pixelId) {
  if (!pixelId || window._c4_pixel_injected) return;
  window._c4_pixel_injected = true;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s);
  }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
  console.info('[C4 Analytics] Meta Pixel injetado:', pixelId);
}

export function injectGA4(measurementId) {
  if (!measurementId || document.getElementById('c4-gtag')) return;
  const s = document.createElement('script');
  s.id = 'c4-gtag';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: true });
  console.info('[C4 Analytics] GA4 injetado:', measurementId);
}

/** Dispara evento em todos os canais configurados */
export function trackEvent(name, params = {}) {
  if (window.fbq) {
    window.fbq('track', name, params);
  }
  if (window.gtag) {
    window.gtag('event', name.toLowerCase().replace(/\s+/g, '_'), params);
  }
}

/** Quando um lead é criado / capturado */
export function trackLead(lead = {}) {
  trackEvent('Lead', {
    currency: 'BRL',
    value: parseFloat(lead.valor_estimado) || 0,
    content_name: lead.nome || '',
    content_category: lead.origem || '',
  });
}

/** Quando um deal é fechado */
export function trackPurchase(deal = {}) {
  trackEvent('Purchase', {
    currency: 'BRL',
    value: parseFloat(deal.valor) || 0,
    content_type: 'product',
  });
}

/** Quando lead avança no funil */
export function trackFunnelStep(step, lead = {}) {
  trackEvent('InitiateCheckout', {
    content_name: step,
    currency: 'BRL',
    value: parseFloat(lead.valor_estimado) || 0,
  });
}
