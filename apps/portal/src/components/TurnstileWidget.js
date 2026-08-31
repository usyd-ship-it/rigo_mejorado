"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Script vanilla de Cloudflare — sin dependencia extra (mismo criterio
// que el resto del portal: Leaflet también se carga a mano, no con un
// wrapper de React). Modo "explicit": nosotros llamamos turnstile.render()
// cuando el contenedor ya existe, en vez de dejar que el script escanee
// el DOM solo.
let turnstileCargado = null;
function cargarTurnstile() {
  if (!turnstileCargado) {
    turnstileCargado = new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error("No se pudo cargar Cloudflare Turnstile"));
      document.head.appendChild(script);
    });
  }
  return turnstileCargado;
}

// Expone reset() por ref — un envío fallido consume el token, hay que
// pedirle uno nuevo a Turnstile antes de reintentar.
const TurnstileWidget = forwardRef(function TurnstileWidget({ sitekey, onToken, onExpirar, onError }, ref) {
  const contenedorRef = useRef(null);
  const widgetIdRef = useRef(null);

  const onTokenRef = useRef(onToken);
  const onExpirarRef = useRef(onExpirar);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onExpirarRef.current = onExpirar;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelado = false;

    cargarTurnstile()
      .then((turnstile) => {
        if (cancelado || !contenedorRef.current || widgetIdRef.current != null) return;
        widgetIdRef.current = turnstile.render(contenedorRef.current, {
          sitekey,
          callback: (token) => onTokenRef.current?.(token),
          "expired-callback": () => onExpirarRef.current?.(),
          "error-callback": () => onErrorRef.current?.(),
        });
      })
      .catch(() => onErrorRef.current?.());

    return () => {
      cancelado = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitekey]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  return <div ref={contenedorRef} />;
});

export default TurnstileWidget;
