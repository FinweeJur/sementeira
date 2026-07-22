import { useEffect, useRef, useState } from "react";
import type { RecursoBiblioteca } from "../lib/types";
import { carregarBiblioteca, salvarBiblioteca, anexarArquivoBiblioteca, abrirArquivoBiblioteca, resolverDocumentosEmbutidos } from "../lib/biblioteca";
import { Section } from "../components/Section";
import { Field, inputClass } from "../components/Field";
import { CabecalhoSecao } from "../components/CabecalhoSecao";
import { Paperclip, FolderOpen, RefreshCw, Trash2, PackageCheck, Loader2, Plus } from "lucide-react";

export function Biblioteca({ onVoltar }: { onVoltar: () => void }) {
  const [itens, setItens] = useState<RecursoBiblioteca[]>(() => carregarBiblioteca());
  const [erro, setErro] = useState<string | null>(null);
  const [anexandoId, setAnexandoId] = useState<string | null>(null);
  const [resolvendoEmbutidos, setResolvendoEmbutidos] = useState(true);
  const [novaReferencia, setNovaReferencia] = useState({ titulo: "", descricao: "" });
  const [novaLeitura, setNovaLeitura] = useState({ titulo: "", fonte: "", url: "" });
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Documentos que já vêm com o app (Proposta Definitiva, Ofícios etc.) só ganham `caminhoArquivo` real na primeira renderização — o app precisa perguntar ao processo main onde eles estão em disco.
  useEffect(() => {
    let cancelado = false;
    resolverDocumentosEmbutidos().then((atualizados) => {
      if (!cancelado) {
        setItens(atualizados);
        setResolvendoEmbutidos(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  function persistir(lista: RecursoBiblioteca[]) {
    setItens(lista);
    salvarBiblioteca(lista);
  }

  async function handleAnexar(recurso: RecursoBiblioteca, arquivo: File) {
    setErro(null);
    setAnexandoId(recurso.id);
    const resultado = await anexarArquivoBiblioteca(recurso.id, arquivo);
    setAnexandoId(null);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Falha ao anexar o arquivo.");
      return;
    }
    persistir(
      itens.map((r) =>
        r.id === recurso.id
          ? { ...r, nomeArquivo: arquivo.name, caminhoArquivo: resultado.caminho, textoExtraido: resultado.textoExtraido, anexadoEm: new Date().toISOString() }
          : r,
      ),
    );
  }

  function removerAnexo(id: string) {
    persistir(itens.map((r) => (r.id === id ? { ...r, nomeArquivo: undefined, caminhoArquivo: undefined, textoExtraido: undefined, anexadoEm: undefined } : r)));
  }

  function removerRecurso(id: string) {
    persistir(itens.filter((r) => r.id !== id));
  }

  function adicionarReferencia() {
    if (!novaReferencia.titulo.trim()) return;
    persistir([
      ...itens,
      { id: crypto.randomUUID(), categoria: "referencia", titulo: novaReferencia.titulo.trim(), descricao: novaReferencia.descricao.trim() || undefined, fixo: false },
    ]);
    setNovaReferencia({ titulo: "", descricao: "" });
  }

  function adicionarLeitura() {
    if (!novaLeitura.titulo.trim()) return;
    persistir([
      ...itens,
      {
        id: crypto.randomUUID(),
        categoria: "leitura",
        titulo: novaLeitura.titulo.trim(),
        fonte: novaLeitura.fonte.trim() || undefined,
        url: novaLeitura.url.trim() || undefined,
      },
    ]);
    setNovaLeitura({ titulo: "", fonte: "", url: "" });
  }

  const referencias = itens.filter((r) => r.categoria === "referencia");
  const leituras = itens.filter((r) => r.categoria === "leitura");

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
        ← Meus projetos
      </button>
      <CabecalhoSecao icone="t" olho="Consulta" titulo="Biblioteca" />
      <p className="text-sm text-[color:var(--sm-text-dim)]">
        Isso não muda o que o acordo permite em nenhum projeto. Guarde aqui os documentos do processo e o material de apoio (artigos, pesquisas, textos) que ajudam a
        pensar os temas discutidos nos projetos: seguem no seu disco, o app só guarda o caminho.
      </p>

      {erro && (
        <div className="rounded border border-[color:var(--sm-bloqueio-border)] bg-[color:var(--sm-bloqueio-bg)] p-3 text-sm text-[color:var(--sm-bloqueio-text)]">{erro}</div>
      )}

      <Section title="Documentos de referência">
        <p className="text-xs text-[color:var(--sm-text-dim)]">Proposta Definitiva, Acordo Judicial, Ofícios — anexe o PDF que você já tem de cada um. Ninguém baixa nada por você.</p>
        <div className="space-y-2">
          {referencias.map((r) => (
            <RecursoCard
              key={r.id}
              recurso={r}
              anexando={anexandoId === r.id}
              resolvendo={resolvendoEmbutidos && !!r.nomeArquivoEmbutido && !r.caminhoArquivo}
              onEscolherArquivo={() => fileInputRefs.current[r.id]?.click()}
              onAbrirArquivo={() => r.caminhoArquivo && abrirArquivoBiblioteca(r.caminhoArquivo).then((res) => !res.ok && setErro(res.erro ?? "Não foi possível abrir o arquivo."))}
              onRemoverAnexo={() => removerAnexo(r.id)}
              onRemoverRecurso={r.fixo ? undefined : () => removerRecurso(r.id)}
            >
              <input
                ref={(el) => {
                  fileInputRefs.current[r.id] = el;
                }}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) handleAnexar(r, arquivo);
                  e.target.value = "";
                }}
              />
            </RecursoCard>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Field label="Título do documento">
            <input className={inputClass} value={novaReferencia.titulo} onChange={(e) => setNovaReferencia({ ...novaReferencia, titulo: e.target.value })} placeholder="Ex.: Ofício 44/2026" />
          </Field>
          <Field label="Descrição (opcional)">
            <input className={inputClass} value={novaReferencia.descricao} onChange={(e) => setNovaReferencia({ ...novaReferencia, descricao: e.target.value })} />
          </Field>
        </div>
        <button
          onClick={adicionarReferencia}
          className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25"
        >
          <Plus size={16} strokeWidth={2} className="text-[color:var(--sm-accent)]" />
          Adicionar documento de referência
        </button>
      </Section>

      <Section title="Leitura complementar">
        <p className="text-xs text-[color:var(--sm-text-dim)]">
          Artigos, textos e pesquisas de fontes reconhecidas (universidades, Ministério Público, órgãos ambientais, ONGs de reparação...) que ajudam a pensar os temas dos projetos — anexe um arquivo ou
          cole um link que você já confira.
        </p>
        <div className="space-y-2">
          {leituras.map((r) => (
            <RecursoCard
              key={r.id}
              recurso={r}
              anexando={anexandoId === r.id}
              resolvendo={resolvendoEmbutidos && !!r.nomeArquivoEmbutido && !r.caminhoArquivo}
              onEscolherArquivo={() => fileInputRefs.current[r.id]?.click()}
              onAbrirArquivo={() => r.caminhoArquivo && abrirArquivoBiblioteca(r.caminhoArquivo).then((res) => !res.ok && setErro(res.erro ?? "Não foi possível abrir o arquivo."))}
              onRemoverAnexo={() => removerAnexo(r.id)}
              onRemoverRecurso={r.fixo ? undefined : () => removerRecurso(r.id)}
            >
              <input
                ref={(el) => {
                  fileInputRefs.current[r.id] = el;
                }}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) handleAnexar(r, arquivo);
                  e.target.value = "";
                }}
              />
            </RecursoCard>
          ))}
          {leituras.length === 0 && <p className="text-sm text-[color:var(--sm-text-dim)]">Nenhuma leitura cadastrada ainda.</p>}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <Field label="Título">
            <input className={inputClass} value={novaLeitura.titulo} onChange={(e) => setNovaLeitura({ ...novaLeitura, titulo: e.target.value })} />
          </Field>
          <Field label="Fonte/autor (opcional)">
            <input className={inputClass} value={novaLeitura.fonte} onChange={(e) => setNovaLeitura({ ...novaLeitura, fonte: e.target.value })} />
          </Field>
          <Field label="Link (opcional)">
            <input className={inputClass} value={novaLeitura.url} onChange={(e) => setNovaLeitura({ ...novaLeitura, url: e.target.value })} placeholder="https://..." />
          </Field>
        </div>
        <button
          onClick={adicionarLeitura}
          className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25"
        >
          <Plus size={16} strokeWidth={2} className="text-[color:var(--sm-accent)]" />
          Adicionar leitura
        </button>
      </Section>
    </div>
  );
}

function RecursoCard({
  recurso,
  anexando,
  resolvendo,
  onEscolherArquivo,
  onAbrirArquivo,
  onRemoverAnexo,
  onRemoverRecurso,
  children,
}: {
  recurso: RecursoBiblioteca;
  anexando: boolean;
  resolvendo: boolean;
  onEscolherArquivo: () => void;
  onAbrirArquivo: () => void;
  onRemoverAnexo: () => void;
  onRemoverRecurso?: () => void;
  children: React.ReactNode;
}) {
  const temAnexo = !!recurso.caminhoArquivo;
  const embutido = !!recurso.nomeArquivoEmbutido;
  return (
    <div className="sm-card rounded-lg border border-[color:var(--sm-border)] bg-[color:var(--sm-panel)] p-3">
      {children}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{recurso.titulo}</p>
          {recurso.descricao && <p className="text-xs text-[color:var(--sm-text-dim)]">{recurso.descricao}</p>}
          {recurso.fonte && <p className="text-xs text-[color:var(--sm-text-dim)]">Fonte: {recurso.fonte}</p>}
          {recurso.url && (
            <a href={recurso.url} target="_blank" rel="noreferrer" className="text-xs text-[color:var(--sm-accent)] underline">
              {recurso.url}
            </a>
          )}
        </div>
        {onRemoverRecurso && (
          <button onClick={onRemoverRecurso} className="shrink-0 rounded p-1 text-[color:var(--sm-bloqueio-text)]" title="Remover" aria-label="Remover">
            <Trash2 size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {resolvendo ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--sm-text-dim)]">
            <Loader2 size={16} strokeWidth={2} className="animate-spin text-[color:var(--sm-accent)]" />
            Preparando documento incluído no app...
          </span>
        ) : temAnexo ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--sm-ok-border)] bg-[color:var(--sm-ok-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--sm-ok-text)]">
              {embutido ? <PackageCheck size={14} strokeWidth={2} /> : <Paperclip size={14} strokeWidth={2} />}
              {embutido ? "Incluído no app" : "Anexado"}
            </span>
            <span className="text-xs text-[color:var(--sm-text-dim)]">{recurso.nomeArquivo}</span>
            <button
              onClick={onAbrirArquivo}
              className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]"
            >
              <FolderOpen size={14} strokeWidth={2} />
              Abrir
            </button>
            <button
              onClick={onEscolherArquivo}
              className="inline-flex items-center gap-1.5 rounded border border-[color:var(--sm-border)] px-2 py-1 text-xs hover:border-[color:var(--sm-accent)]"
            >
              <RefreshCw size={14} strokeWidth={2} />
              Substituir
            </button>
            <button onClick={onRemoverAnexo} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[color:var(--sm-bloqueio-text)]">
              <Trash2 size={14} strokeWidth={2} />
              Remover anexo
            </button>
          </>
        ) : (
          <button
            onClick={onEscolherArquivo}
            disabled={anexando}
            className="inline-flex items-center gap-1.5 rounded border border-dashed border-[color:var(--sm-border)] px-2 py-1 text-xs text-[color:var(--sm-text-dim)] hover:border-[color:var(--sm-accent)] hover:text-[color:var(--sm-text)] disabled:opacity-40"
          >
            {anexando ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Paperclip size={14} strokeWidth={2} />}
            {anexando ? "Anexando..." : "Anexar arquivo (PDF/DOCX)"}
          </button>
        )}
      </div>
    </div>
  );
}
