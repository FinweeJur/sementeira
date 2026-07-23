/* eslint-disable no-undef */
/**
 * Service worker da versão web.
 *
 * Existe por um motivo concreto: o app é servido da máquina de quem hospeda, e
 * essa máquina desliga. Sem cache, desligar o servidor deixaria quem já usava o
 * app com uma tela de erro — num produto cuja identidade é funcionar offline.
 * Com ele, depois da primeira visita o app abre e funciona normalmente; só a
 * IA fica indisponível enquanto o servidor estiver fora.
 *
 * Escrito à mão, sem plugin de build: são poucas regras e assim não entra
 * dependência nova nem etapa nova no `npm run build`.
 */

const CACHE = "sementeira-v1";

/**
 * Guarda o essencial já na instalação.
 *
 * Sem isto, a primeira visita não fica protegida: quando o service worker
 * assume, o `index.html` e o bundle já foram baixados pela própria página e
 * nunca passaram por ele — medido, o cache ficava só com as fontes, e derrubar
 * o servidor ainda dava tela de erro. Como os nomes dos assets têm hash gerado
 * no build, eles são descobertos lendo o próprio index.html.
 */
async function guardarOEssencial() {
  const cache = await caches.open(CACHE);
  const resp = await fetch("./index.html", { cache: "reload" });
  if (!resp.ok) return;
  const html = await resp.clone().text();
  await cache.put("./index.html", resp);

  const urls = new Set(["./manifest.webmanifest"]);
  for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|woff2))"/g)) {
    urls.add(m[1]);
  }
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const r = await fetch(url, { cache: "reload" });
        if (r.ok) await cache.put(url, r);
      } catch {
        // Um asset que não baixou agora será pego no primeiro uso.
      }
    }),
  );
}

self.addEventListener("install", (evento) => {
  // Assume o controle já na primeira visita, em vez de só na próxima aba.
  evento.waitUntil(guardarOEssencial().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // Limpa versões antigas do cache para não acumular build sobre build.
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/** `/api/` nunca é cacheado: é IA e estado do servidor, onde resposta velha é pior que erro. */
function ehApi(url) {
  return url.pathname.startsWith("/api/");
}

/** Assets do Vite trazem hash no nome — mudou o conteúdo, mudou a URL. Podem ser servidos do cache sem medo. */
function ehAssetComHash(url) {
  return url.pathname.includes("/assets/");
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Só cuidamos da própria origem: DeepSeek, Tavily, Ollama e os tiles do
  // OpenStreetMap passam direto, sem interferência.
  if (url.origin !== self.location.origin) return;
  if (ehApi(url)) return;

  if (ehAssetComHash(url)) {
    // Cache-first: o hash garante que nunca serviremos conteúdo errado.
    evento.respondWith(
      caches.match(req).then(
        (cacheado) =>
          cacheado ??
          fetch(req).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return resp;
          }),
      ),
    );
    return;
  }

  // Demais recursos (index.html à frente): rede primeiro, para pegar
  // atualização assim que o servidor voltar; cache como rede de segurança.
  evento.respondWith(
    (async () => {
      try {
        const resp = await fetch(req);
        if (resp.ok) {
          const copia = resp.clone();
          const cache = await caches.open(CACHE);
          await cache.put(req, copia);
        }
        return resp;
      } catch {
        const cacheado = await caches.match(req);
        if (cacheado) return cacheado;
        // Navegação sem cache específico cai no index.html — é uma SPA.
        if (req.mode === "navigate") {
          const indice = await caches.match("./index.html");
          if (indice) return indice;
        }
        throw new Error("sem rede e sem cópia guardada");
      }
    })(),
  );
});
