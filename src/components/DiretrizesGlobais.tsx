import { useState } from "react";
import { carregarDiretrizesGlobais, adicionarDiretrizGlobal, removerDiretrizGlobal, type DiretrizGlobal } from "../lib/diretrizes-globais";
import { extrairTextoDeArquivo } from "../lib/file-extraction";

export function DiretrizesGlobais() {
  const [diretrizes, setDiretrizes] = useState<DiretrizGlobal[]>(carregarDiretrizesGlobais());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);
    const resultado = await extrairTextoDeArquivo(arquivo);
    setCarregando(false);
    if (!resultado.ok || !resultado.texto) {
      setErro(resultado.erro ?? "Falha ao ler o arquivo.");
      return;
    }
    setDiretrizes(adicionarDiretrizGlobal(arquivo.name, resultado.texto));
  }

  function remover(id: string) {
    setDiretrizes(removerDiretrizGlobal(id));
  }

  return (
    <div className="space-y-2 rounded border border-[color:var(--sm-border)] p-3">
      <p className="text-sm font-medium">Diretrizes gerais (aplicadas a todos os projetos)</p>
      <p className="text-xs text-[color:var(--sm-text-dim)]">
        Anexe editais, orientações da Entidade Gestora etc. (.pdf, .docx, .txt). Elas entram no contexto da IA em todo projeto — mas nunca podem contradizer as vedações do Ofício 46, que sempre prevalece.
      </p>
      <label className="inline-flex cursor-pointer items-center rounded border border-dashed border-[color:var(--sm-border)] px-3 py-1.5 text-xs hover:border-[color:var(--sm-accent)]">
        {carregando ? "Lendo arquivo..." : "+ Anexar diretriz"}
        <input type="file" accept=".pdf,.docx,.txt,text/plain" className="hidden" onChange={handleUpload} disabled={carregando} />
      </label>
      {erro && <p className="text-xs text-[color:var(--sm-red)]">{erro}</p>}
      <ul className="space-y-1">
        {diretrizes.map((d) => (
          <li key={d.id} className="flex items-center justify-between rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs">
            <span>{d.nomeArquivo} ({d.texto.length.toLocaleString("pt-BR")} caracteres)</span>
            <button onClick={() => remover(d.id)} className="text-[color:var(--sm-red)]">
              remover
            </button>
          </li>
        ))}
        {diretrizes.length === 0 && <li className="text-xs text-[color:var(--sm-text-dim)]">Nenhuma diretriz anexada.</li>}
      </ul>
    </div>
  );
}
