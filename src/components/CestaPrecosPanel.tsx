import { useState } from "react";
import { Landmark, TriangleAlert, ChevronDown, ChevronRight } from "lucide-react";
import type { ResultadoCotacaoPublica } from "../lib/cotacao-publica";
import { formatarReal } from "../lib/precos-publicos";

const ROTULO_ABRANGENCIA: Record<string, string> = {
  paraopeba: "municípios da bacia do Paraopeba",
  mg: "Minas Gerais",
  brasil: "Brasil inteiro",
};

/**
 * Mostra de onde veio o preço sugerido.
 *
 * O painel existe para o valor não chegar sozinho na prestação de contas: quem for
 * questionado precisa poder apontar o órgão, a data e o fornecedor de cada preço que
 * entrou na conta. Por isso a lista de compras fica acessível, e não só o número final.
 */
export function CestaPrecosPanel({ resultado }: { resultado: ResultadoCotacaoPublica }) {
  const [aberto, setAberto] = useState(false);
  const cesta = resultado.cesta;
  if (!cesta || cesta.estatistica.n === 0) return null;

  const { estatistica: e } = cesta;

  return (
    <div className="mx-3 mb-2 rounded border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Landmark size={13} strokeWidth={2} aria-hidden="true" className="flex-none" />
        <span>
          <strong>{formatarReal(cesta.valorSugerido)}</strong> — valor do meio de {e.n} compra{e.n > 1 ? "s" : ""} pública{e.n > 1 ? "s" : ""} de{" "}
          {ROTULO_ABRANGENCIA[cesta.abrangencia] ?? cesta.abrangencia}
        </span>
        <span className="text-[color:var(--sm-text-dim)]">
          (de {formatarReal(e.minimo)} a {formatarReal(e.maximo)}, por {cesta.unidade})
        </span>
      </div>

      {resultado.itemEscolhido && (
        <p className="mt-1 text-[color:var(--sm-text-dim)]">
          Item do catálogo público: {resultado.itemEscolhido.nome}
          {cesta.foraDoRecorte.length > 0 && ` · ${cesta.foraDoRecorte.length} preço(s) de outras regiões ficaram de fora`}
        </p>
      )}

      {cesta.alertas.map((alerta) => (
        <p key={alerta} className="mt-1 flex items-start gap-1.5 text-[color:var(--sm-amber,#b45309)]">
          <TriangleAlert size={13} strokeWidth={2} aria-hidden="true" className="mt-px flex-none" />
          <span>{alerta}</span>
        </p>
      ))}

      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="mt-1.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]"
      >
        {aberto ? <ChevronDown size={12} strokeWidth={2} aria-hidden="true" /> : <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />}
        {aberto ? "Esconder as compras usadas" : "Ver as compras que geraram esse valor"}
      </button>

      {aberto && (
        <div className="mt-1.5 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead className="text-[color:var(--sm-text-dim)]">
              <tr>
                <th className="py-1 pr-2 font-medium">Valor</th>
                <th className="py-1 pr-2 font-medium">Órgão que comprou</th>
                <th className="py-1 pr-2 font-medium">Onde</th>
                <th className="py-1 pr-2 font-medium">Quando</th>
                <th className="py-1 font-medium">Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {cesta.usadas.map((o, i) => (
                <tr key={`${o.orgao}-${o.data}-${o.precoUnitario}-${i}`} className="border-t border-[color:var(--sm-border)]">
                  <td className="py-1 pr-2 whitespace-nowrap">{formatarReal(o.precoUnitario)}</td>
                  <td className="py-1 pr-2">{o.orgao || "—"}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {o.municipio}/{o.uf}
                  </td>
                  <td className="py-1 pr-2 whitespace-nowrap">{o.data || "—"}</td>
                  <td className="py-1">{o.fornecedor || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[color:var(--sm-text-dim)]">
            Fonte: Compras.gov.br (preços homologados). O valor sugerido é o do meio da lista, que não se desloca por causa de uma compra fora do padrão.
          </p>
        </div>
      )}
    </div>
  );
}
