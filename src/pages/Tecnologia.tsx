import { useState } from "react";
import { Factory, Search, Loader2, TriangleAlert, ExternalLink, Plus, Check, Store, Ship, Globe2 } from "lucide-react";
import type { BudgetLine, Project } from "../lib/types";
import { CabecalhoSecao } from "../components/CabecalhoSecao";
import { Section } from "../components/Section";
import { Field, inputClass } from "../components/Field";
import { Tooltip } from "../components/Tooltip";
import { alertasDeAquisicao, estimarCustoImportacao, pesquisarMaquinas, referenciaDeMercado, type OrigemMercado, type PesquisaMaquinas } from "../lib/maquinas";
import { buscarWeb, carregarConfigTavily } from "../lib/websearch";
import { formatarReal } from "../lib/precos-publicos";

/** Cotação do dólar fica guardada porque o app é offline-first: buscar em API sem alternativa deixaria a conta indisponível justamente quando não há internet. */
const CHAVE_COTACAO = "sementeira-cotacao-dolar-v1";
const COTACAO_PADRAO = 5.4;
/** Vida útil sugerida para máquina de produção — só um ponto de partida, editável antes de lançar. */
const VIDA_UTIL_PADRAO = 10;

const ORIGENS: { id: OrigemMercado; rotulo: string; icone: typeof Store; dica: string }[] = [
  { id: "brasil", rotulo: "Brasil", icone: Store, dica: "Fornecedor nacional: preço já com imposto, e assistência técnica ao alcance" },
  { id: "china", rotulo: "China (importação)", icone: Ship, dica: "Catálogo chinês: preço FOB, que ainda vai receber imposto, frete e despacho" },
  { id: "aberta", rotulo: "Busca aberta", icone: Globe2, dica: "Sem restringir a vitrine: fabricante, representante, assistência técnica" },
];

function carregarCotacao(): number {
  const bruto = Number(localStorage.getItem(CHAVE_COTACAO));
  return Number.isFinite(bruto) && bruto > 0 ? bruto : COTACAO_PADRAO;
}

/** Estado do formulário de lançamento, aberto embaixo do anúncio escolhido. */
interface Lancamento {
  url: string;
  origem: OrigemMercado;
  titulo: string;
  projetoId: string;
  descricao: string;
  valor: string;
  vidaUtilAnos: string;
}

/**
 * Tela da pesquisa de máquinas — o que o projeto compra para o trabalho render mais.
 *
 * O módulo `lib/maquinas.ts` já fazia a parte difícil e não tinha por onde ser alcançado. O que
 * a tela acrescenta é a separação que uma busca solta não faz: preço de fornecedor brasileiro e
 * preço de catálogo chinês não são comparáveis lado a lado, porque o segundo ainda vai receber
 * imposto, frete e despacho. Por isso a calculadora de importação fica na mesma tela, e o
 * número que ela mostra em destaque é o multiplicador.
 *
 * Sem chave da Tavily a tela não fica vazia: a calculadora e os alertas de aquisição não
 * dependem de rede, e são justamente a parte que costuma decidir a compra numa associação.
 */
export function Tecnologia({
  projects,
  onVoltar,
  onAtualizarProjeto,
  onAbrirConfig,
}: {
  projects: Project[];
  onVoltar: () => void;
  onAtualizarProjeto: (p: Project) => void;
  onAbrirConfig: () => void;
}) {
  const [necessidade, setNecessidade] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [pesquisa, setPesquisa] = useState<PesquisaMaquinas | null>(null);
  const [origemAtiva, setOrigemAtiva] = useState<OrigemMercado>("brasil");

  const [precoFobUsd, setPrecoFobUsd] = useState("");
  const [cotacaoDolar, setCotacaoDolar] = useState(() => String(carregarCotacao()));

  const [lancamento, setLancamento] = useState<Lancamento | null>(null);
  const [lancado, setLancado] = useState<string | null>(null);

  // Lido a cada render (não em estado): quem configurar a chave no modal de Configurações vê a
  // tela liberar sem precisar sair e voltar.
  const temChave = Boolean(carregarConfigTavily().apiKey);

  const fob = Number(precoFobUsd.replace(",", "."));
  const cotacao = Number(cotacaoDolar.replace(",", "."));
  const custo = estimarCustoImportacao(Number.isFinite(fob) ? fob : 0, Number.isFinite(cotacao) && cotacao > 0 ? cotacao : COTACAO_PADRAO);

  const daOrigem = pesquisa?.porOrigem.find((o) => o.origem === origemAtiva);

  async function pesquisar() {
    if (!necessidade.trim() || buscando) return;
    setBuscando(true);
    setLancamento(null);
    setLancado(null);
    const resultado = await pesquisarMaquinas({ necessidade: necessidade.trim(), capacidade: capacidade.trim() || undefined }, buscarWeb);
    setPesquisa(resultado);
    setBuscando(false);
  }

  function guardarCotacao(valor: string) {
    setCotacaoDolar(valor);
    const numero = Number(valor.replace(",", "."));
    if (Number.isFinite(numero) && numero > 0) localStorage.setItem(CHAVE_COTACAO, String(numero));
  }

  function abrirLancamento(titulo: string, url: string, origem: OrigemMercado) {
    // Na origem chinesa o valor que interessa é o posto no Brasil, não o do anúncio: sugerir o
    // FOB aqui seria repetir na linha do orçamento o erro que a calculadora existe para evitar.
    const sugestao = origem === "china" && custo.total > 0 ? custo.total.toFixed(2) : "";
    setLancado(null);
    setLancamento({
      url,
      origem,
      titulo,
      projetoId: projects[0]?.id ?? "",
      descricao: titulo.slice(0, 120),
      valor: sugestao,
      vidaUtilAnos: String(VIDA_UTIL_PADRAO),
    });
  }

  function confirmarLancamento() {
    if (!lancamento) return;
    const projeto = projects.find((p) => p.id === lancamento.projetoId);
    const valor = Number(lancamento.valor.replace(",", "."));
    if (!projeto || !Number.isFinite(valor) || valor <= 0) return;

    const vidaUtil = Number(lancamento.vidaUtilAnos);
    const postoNoBrasil = lancamento.origem === "china" && custo.total > 0 && Math.abs(valor - custo.total) < 1;
    const linha: BudgetLine = {
      id: crypto.randomUUID(),
      categoria: "equipamento",
      descricao: lancamento.descricao.trim() || lancamento.titulo,
      valor,
      vidaUtilAnos: Number.isFinite(vidaUtil) && vidaUtil > 0 ? vidaUtil : undefined,
      referenciaPreco: referenciaDeMercado({
        origem: lancamento.origem,
        titulo: lancamento.titulo,
        url: lancamento.url,
        valor,
        postoNoBrasil,
        consultadoEm: new Date(),
      }),
    };

    onAtualizarProjeto({ ...projeto, orcamento: [...projeto.orcamento, linha] });
    setLancamento(null);
    setLancado(`Lançado em "${projeto.titulo || "(sem título)"}" como item de equipamento. Confira na etapa de orçamento do projeto.`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
        ← Meus projetos
      </button>
      <CabecalhoSecao
        icone="t"
        olho="Máquina e produção"
        titulo="Tecnologia"
        apoio="Procura a máquina que faz o trabalho render mais, separando o que se compra aqui do que viria de fora — porque preço de catálogo chinês não é preço de compra. Isso não muda o que o acordo permite em cada projeto."
      />

      <Section
        title={
          <>
            <Search size={16} strokeWidth={2} />O que a máquina precisa fazer
          </>
        }
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Necessidade" hint='Na sua língua mesmo: "despolpar fruta", "costurar uniforme", "moer milho"'>
            <input
              className={inputClass}
              value={necessidade}
              onChange={(e) => setNecessidade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pesquisar()}
              placeholder="Ex.: despolpar fruta"
            />
          </Field>
          <Field label="Capacidade (opcional)" hint="Quanto precisa produzir, se o projeto já sabe">
            <input
              className={inputClass}
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pesquisar()}
              placeholder="Ex.: 100 kg/h"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={pesquisar}
            disabled={!necessidade.trim() || !temChave || buscando}
            className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-50"
          >
            {buscando ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Search size={14} strokeWidth={2} />}
            {buscando ? "Procurando..." : "Procurar máquina"}
          </button>
          <span className="text-xs text-[color:var(--sm-text-dim)]">A busca sai em português no Brasil e em inglês na China — é assim que o catálogo de lá aparece.</span>
        </div>

        {!temChave && (
          <div className="rounded border border-[color:var(--sm-atencao-border)] bg-[color:var(--sm-atencao-bg)] p-3 text-xs text-[color:var(--sm-atencao-text)]">
            <p className="flex items-start gap-1.5">
              <TriangleAlert size={13} strokeWidth={2} aria-hidden="true" className="mt-px flex-none" />
              <span>
                A procura na internet precisa da chave da Tavily, que ainda não está configurada. O resto desta tela funciona sem internet: a conta de importação e os
                avisos de antes de comprar continuam valendo.
              </span>
            </p>
            <button onClick={onAbrirConfig} className="mt-2 rounded border border-[color:var(--sm-atencao-border)] px-2 py-1 hover:border-[color:var(--sm-accent)]">
              Abrir Configurações
            </button>
          </div>
        )}
      </Section>

      <Section
        title={
          <>
            <Factory size={16} strokeWidth={2} />
            Onde procurar
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {ORIGENS.map((o) => (
            <Tooltip key={o.id} texto={o.dica} posicao="bottom">
              <button
                onClick={() => setOrigemAtiva(o.id)}
                aria-pressed={origemAtiva === o.id}
                className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs ${
                  origemAtiva === o.id ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)] hover:border-[color:var(--sm-accent)]"
                }`}
              >
                <o.icone size={14} strokeWidth={2} />
                {o.rotulo}
              </button>
            </Tooltip>
          ))}
        </div>

        {lancado && (
          <p className="flex items-start gap-1.5 rounded border border-[color:var(--sm-ok-border)] bg-[color:var(--sm-ok-bg)] p-2 text-xs text-[color:var(--sm-ok-text)]">
            <Check size={13} strokeWidth={2} aria-hidden="true" className="mt-px flex-none" />
            <span>{lancado}</span>
          </p>
        )}

        {!pesquisa && <p className="text-sm text-[color:var(--sm-text-dim)]">Descreva a necessidade acima para ver o que existe à venda em cada origem.</p>}

        {daOrigem?.erro && (
          <p className="flex items-start gap-1.5 text-xs text-[color:var(--sm-atencao-text)]">
            <TriangleAlert size={13} strokeWidth={2} aria-hidden="true" className="mt-px flex-none" />
            <span>{daOrigem.erro}</span>
          </p>
        )}

        {daOrigem && daOrigem.resultados.length === 0 && !daOrigem.erro && (
          <p className="text-sm text-[color:var(--sm-text-dim)]">
            Nada encontrado nesta origem. Máquina específica de produção costuma não aparecer em vitrine — nesse caso o caminho é pedir cotação direta a pelo menos três
            fornecedores.
          </p>
        )}

        <ul className="space-y-2">
          {(daOrigem?.resultados ?? []).map((r) => (
            <li key={r.url} className="rounded border border-[color:var(--sm-border)] p-3 text-sm">
              <p className="font-medium">{r.titulo}</p>
              {r.conteudo && <p className="mt-1 line-clamp-3 text-xs text-[color:var(--sm-text-dim)]">{r.conteudo}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[color:var(--sm-accent)] hover:underline">
                  <ExternalLink size={12} strokeWidth={2} />
                  Ver anúncio
                </a>
                <button
                  onClick={() => abrirLancamento(r.titulo, r.url, origemAtiva)}
                  disabled={projects.length === 0}
                  className="inline-flex items-center gap-1 rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)] disabled:opacity-50"
                >
                  <Plus size={12} strokeWidth={2} />
                  Lançar no orçamento
                </button>
                {projects.length === 0 && <span className="text-xs text-[color:var(--sm-text-dim)]">Crie um projeto para poder lançar.</span>}
              </div>

              {lancamento?.url === r.url && (
                <div className="mt-3 space-y-2 border-t border-[color:var(--sm-border)] pt-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="Projeto">
                      <select className={inputClass} value={lancamento.projetoId} onChange={(e) => setLancamento({ ...lancamento, projetoId: e.target.value })}>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.titulo || "(sem título)"}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Descrição da linha">
                      <input className={inputClass} value={lancamento.descricao} onChange={(e) => setLancamento({ ...lancamento, descricao: e.target.value })} />
                    </Field>
                    <Field
                      label="Valor (R$)"
                      hint={
                        lancamento.origem === "china"
                          ? "Use o custo posto no Brasil da conta abaixo, não o preço do anúncio."
                          : "Confirme o valor no anúncio, com frete até o município do projeto."
                      }
                    >
                      <input
                        type="number"
                        step="0.01"
                        className={inputClass}
                        value={lancamento.valor}
                        onChange={(e) => setLancamento({ ...lancamento, valor: e.target.value })}
                      />
                    </Field>
                    <Field label="Vida útil (anos)" hint="Entra na depreciação do simulador de sustentabilidade.">
                      <input
                        type="number"
                        className={inputClass}
                        value={lancamento.vidaUtilAnos}
                        onChange={(e) => setLancamento({ ...lancamento, vidaUtilAnos: e.target.value })}
                      />
                    </Field>
                  </div>
                  <p className="text-xs text-[color:var(--sm-text-dim)]">
                    A linha vai guardar que este preço é de anúncio de fornecedor, e não de compra pública — a diferença aparece no documento exportado.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={confirmarLancamento}
                      disabled={!lancamento.projetoId || !(Number(lancamento.valor.replace(",", ".")) > 0)}
                      className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-xs hover:bg-[color:var(--sm-accent)]/25 disabled:opacity-50"
                    >
                      Lançar no orçamento
                    </button>
                    <button onClick={() => setLancamento(null)} className="rounded border border-[color:var(--sm-border)] px-3 py-1.5 text-xs">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={
          <>
            <Ship size={16} strokeWidth={2} />
            Quanto custa posto no Brasil
          </>
        }
      >
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          O preço de catálogo chinês é FOB: sai da fábrica de lá e ainda vai receber frete, imposto e despacho. Somar as alíquotas na mão dá menos do que o valor real,
          porque cada tributo entra na base do seguinte.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Preço anunciado (US$)">
            <input type="number" step="0.01" className={inputClass} value={precoFobUsd} onChange={(e) => setPrecoFobUsd(e.target.value)} placeholder="Ex.: 1200" />
          </Field>
          <Field label="Dólar (R$)" hint="Fica guardado neste computador — o app funciona sem internet.">
            <input type="number" step="0.01" className={inputClass} value={cotacaoDolar} onChange={(e) => guardarCotacao(e.target.value)} />
          </Field>
        </div>

        {custo.total > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/10 p-3">
              <span className="text-2xl font-semibold text-[color:var(--sm-text)]">{custo.multiplicador.toFixed(2)}×</span>
              <span className="text-sm">
                o preço de vitrine — {formatarReal(custo.fobBrl)} viram <strong>{formatarReal(custo.total)}</strong> aqui.
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-left text-xs">
                <tbody>
                  {[
                    ["Preço anunciado, em reais", custo.fobBrl],
                    ["Valor aduaneiro (com frete e seguro)", custo.valorAduaneiro],
                    ["Imposto de importação", custo.ii],
                    ["IPI", custo.ipi],
                    ["PIS", custo.pis],
                    ["COFINS", custo.cofins],
                    ["ICMS (calculado por dentro)", custo.icms],
                    ["Despachante, armazenagem, frete interno", custo.despesasOperacionais],
                    ["Total posto no Brasil", custo.total],
                  ].map(([rotulo, valor]) => (
                    <tr key={String(rotulo)} className="border-t border-[color:var(--sm-border)]">
                      <td className="py-1 pr-2">{rotulo}</td>
                      <td className="py-1 text-right whitespace-nowrap">{formatarReal(Number(valor))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[color:var(--sm-text-dim)]">
              É estimativa de ordem de grandeza, não cálculo aduaneiro: a alíquota real depende do NCM do produto, e há regimes que mudam o resultado. Serve para saber se
              vale a pena continuar olhando, não para fechar contrato.
            </p>
          </div>
        )}
      </Section>

      <Section
        title={
          <>
            <TriangleAlert size={16} strokeWidth={2} />
            Antes de comprar
          </>
        }
      >
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Numa associação comunitária, a máquina mais barata muitas vezes é a que não pode ser usada. Estes avisos valem para a origem escolhida acima.
        </p>
        <ul className="space-y-2 text-sm">
          {alertasDeAquisicao(origemAtiva).map((alerta) => (
            <li key={alerta} className="flex items-start gap-1.5">
              <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" className="mt-0.5 flex-none text-[color:var(--sm-atencao-text)]" />
              <span>{alerta}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
