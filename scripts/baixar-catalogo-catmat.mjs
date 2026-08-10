/**
 * Baixa o catálogo de PDMs do CATMAT (Compras.gov.br) e grava `src/data/catmat-pdm.json`.
 *
 * Por que embarcar o catálogo em vez de consultar na hora:
 *
 * A API de catálogo do Compras.gov.br **não tem busca textual**. O parâmetro `descricaoItem`
 * é igualdade exata, e `/3_consultarPdmMaterial` não aceita filtro por nome — pior, ele
 * *ignora em silêncio* qualquer parâmetro desconhecido e devolve HTTP 200 com a lista
 * inteira, então uma busca por nome parece funcionar e não filtra nada.
 *
 * Como só dá para chegar no preço tendo o código do PDM, a saída é ter o catálogo local:
 * a busca por texto ("batedeira", "despolpadeira") passa a ser feita aqui dentro, o que
 * de quebra mantém o app offline-first.
 *
 * Uso: `node scripts/baixar-catalogo-catmat.mjs`
 * Rodar de novo só quando o catálogo mudar (é estável; muda em escala de meses).
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://dadosabertos.compras.gov.br/modulo-material/3_consultarPdmMaterial";
const POR_PAGINA = 500; // máximo aceito pela API (ela recusa fora do intervalo 10–500)
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = join(raiz, "src", "data", "catmat-pdm.json");

async function baixarPagina(pagina) {
  const url = `${BASE}?pagina=${pagina}&tamanhoPagina=${POR_PAGINA}`;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resp = await fetch(url, { headers: { accept: "application/json" } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (erro) {
      if (tentativa === 3) throw erro;
      await new Promise((r) => setTimeout(r, 1500 * tentativa));
    }
  }
}

const primeira = await baixarPagina(1);
const totalPaginas = primeira.totalPaginas;
console.log(`Catálogo CATMAT: ${primeira.totalRegistros} PDMs em ${totalPaginas} páginas.`);

const registros = [...primeira.resultado];
for (let p = 2; p <= totalPaginas; p++) {
  const pagina = await baixarPagina(p);
  registros.push(...pagina.resultado);
  if (p % 10 === 0 || p === totalPaginas) console.log(`  ${registros.length} PDMs…`);
}

// Classes viram tabela à parte: o nome da classe se repete em dezenas de PDMs e
// desduplicar corta perto de um terço do arquivo.
const classes = new Map();
for (const r of registros) {
  if (r.codigoClasse != null && !classes.has(r.codigoClasse)) classes.set(r.codigoClasse, r.nomeClasse ?? "");
}

const saida = {
  geradoEm: new Date().toISOString().slice(0, 10),
  fonte: BASE,
  classes: Object.fromEntries(classes),
  // [codigoPdm, nomePdm, codigoClasse, ativo] — array em vez de objeto para encolher o arquivo.
  pdms: registros
    .filter((r) => r.codigoPdm != null && r.nomePdm)
    .map((r) => [r.codigoPdm, String(r.nomePdm).replace(/^"|"$/g, "").trim(), r.codigoClasse ?? 0, r.statusPdm ? 1 : 0]),
};

await writeFile(DESTINO, JSON.stringify(saida), "utf8");
console.log(`Gravado ${DESTINO} — ${saida.pdms.length} PDMs, ${classes.size} classes.`);
