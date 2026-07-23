import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

/**
 * Service worker só na versão web servida por http(s). No app instalado a
 * página vem de `file://`, onde service worker não é permitido — e nem faria
 * sentido, já que ali os arquivos são locais.
 */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Falhar em registrar não pode derrubar o app: sem service worker ele
      // continua funcionando, só perde a resistência a servidor fora do ar.
    });
  });
}
