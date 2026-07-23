/**
 * Extração de JSON de respostas de LLM — helper compartilhado por todos os
 * módulos de IA.
 *
 * O caminho ingênuo (pegar do primeiro `{` ao último `}`) quebra em três
 * formatos que modelos reais produzem o tempo todo:
 *
 *  1. Modelos de raciocínio (R1 e derivados) emitem `<think>…</think>` antes
 *     da resposta; qualquer `{` dentro do raciocínio virava o início do
 *     "JSON" e o parse falhava.
 *  2. Prosa depois do JSON ("obs: o campo {metas} pode mudar") estendia a
 *     captura para além do objeto.
 *  3. O modelo ecoa o exemplo de formato que veio no prompt e só depois
 *     responde de verdade — pegar o primeiro bloco devolvia o exemplo, sem
 *     erro nenhum, silenciosamente errado.
 *
 * Estratégia: limpar o raciocínio, juntar todos os candidatos (blocos
 * cercados por ``` e objetos de chaves balanceadas) e ficar com o ÚLTIMO que
 * realmente faz parse — a resposta final de um LLM vem no fim.
 */

/** Remove blocos de raciocínio que modelos como o R1 emitem antes da resposta. */
function removerRaciocinio(texto: string): string {
  return texto.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, " ");
}

/**
 * Varre o texto e devolve cada objeto `{…}` de chaves balanceadas, ignorando
 * chaves que aparecem dentro de strings JSON. Só objetos de nível mais
 * externo — o conteúdo aninhado vem junto no recorte do pai.
 */
function candidatosPorChaves(texto: string): string[] {
  const encontrados: string[] = [];
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== "{") continue;
    let profundidade = 0;
    let emString = false;
    let escapado = false;
    for (let j = i; j < texto.length; j++) {
      const c = texto[j];
      if (escapado) {
        escapado = false;
        continue;
      }
      if (emString) {
        if (c === "\\") escapado = true;
        else if (c === '"') emString = false;
        continue;
      }
      if (c === '"') emString = true;
      else if (c === "{") profundidade++;
      else if (c === "}") {
        profundidade--;
        if (profundidade === 0) {
          encontrados.push(texto.slice(i, j + 1));
          i = j;
          break;
        }
      }
    }
  }
  return encontrados;
}

function tentarParse(candidato: string): unknown | undefined {
  try {
    return JSON.parse(candidato.trim());
  } catch {
    return undefined;
  }
}

/** Um objeto/array com pelo menos um campo — descarta `{}` solto em prosa. */
function temConteudo(valor: unknown): boolean {
  return typeof valor === "object" && valor !== null && Object.keys(valor).length > 0;
}

/**
 * Extrai de uma resposta de LLM o trecho que é JSON válido. Devolve `null`
 * quando nada no texto faz parse.
 */
export function extrairBlocoJson(texto: string): string | null {
  const limpo = removerRaciocinio(texto);

  const candidatos: string[] = [];
  for (const m of limpo.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    if (m[1]) candidatos.push(m[1]);
  }
  candidatos.push(...candidatosPorChaves(limpo));

  let ultimoValido: string | null = null;
  let ultimoComConteudo: string | null = null;
  for (const candidato of candidatos) {
    const valor = tentarParse(candidato);
    if (valor === undefined) continue;
    ultimoValido = candidato;
    if (temConteudo(valor)) ultimoComConteudo = candidato;
  }
  return ultimoComConteudo ?? ultimoValido;
}

/** Faz parse do bloco JSON de uma resposta de LLM; retorna null em vez de lançar. */
export function parseJsonDeResposta<T>(texto: string): T | null {
  const bloco = extrairBlocoJson(texto);
  if (!bloco) return null;
  try {
    return JSON.parse(bloco.trim()) as T;
  } catch {
    return null;
  }
}
