import { useState } from "react";
import type { Project, Voluntario } from "../lib/types";
import { carregarVoluntarios, salvarVoluntarios, sugerirVoluntariosParaProjeto } from "../lib/voluntarios";
import { Section } from "../components/Section";
import { Field, inputClass } from "../components/Field";
import { CabecalhoSecao } from "../components/CabecalhoSecao";
import { Check, Plus } from "lucide-react";

/** Cadastro de voluntários em nível de portfólio (Fase 14a) — trabalho pontual/mutirão, não substitui posto de folha permanente. */
export function Voluntarios({ projects, onVoltar }: { projects: Project[]; onVoltar: () => void }) {
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>(() => carregarVoluntarios());
  const [filtroHabilidade, setFiltroHabilidade] = useState("");
  const [novo, setNovo] = useState({ nome: "", telefone: "", email: "", habilidades: "", disponibilidadeHorasSemana: "", observacoes: "" });

  function persistir(lista: Voluntario[]) {
    setVoluntarios(lista);
    salvarVoluntarios(lista);
  }

  function adicionar() {
    if (!novo.nome.trim()) return;
    const v: Voluntario = {
      id: crypto.randomUUID(),
      nome: novo.nome.trim(),
      telefone: novo.telefone.trim() || undefined,
      email: novo.email.trim() || undefined,
      habilidades: novo.habilidades
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
      disponibilidadeHorasSemana: novo.disponibilidadeHorasSemana ? Number(novo.disponibilidadeHorasSemana) : undefined,
      observacoes: novo.observacoes.trim() || undefined,
      cadastradoEm: new Date().toISOString(),
    };
    persistir([...voluntarios, v]);
    setNovo({ nome: "", telefone: "", email: "", habilidades: "", disponibilidadeHorasSemana: "", observacoes: "" });
  }

  function remover(id: string) {
    persistir(voluntarios.filter((v) => v.id !== id));
  }

  function alternarInteresse(voluntarioId: string, projectId: string) {
    persistir(
      voluntarios.map((v) => {
        if (v.id !== voluntarioId) return v;
        const atual = v.projetosDeInteresse ?? [];
        const tem = atual.includes(projectId);
        return { ...v, projetosDeInteresse: tem ? atual.filter((id) => id !== projectId) : [...atual, projectId] };
      }),
    );
  }

  const listaFiltrada = filtroHabilidade.trim()
    ? voluntarios.filter((v) => (v.habilidades ?? []).some((h) => h.toLowerCase().includes(filtroHabilidade.trim().toLowerCase())))
    : voluntarios;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
        ← Meus projetos
      </button>
      <CabecalhoSecao
        icone="g"
        olho="Rede da comunidade"
        titulo="Voluntários"
        apoio="Trabalho voluntário ou mutirão reduz o custo de equipe sem virar salário — mas não substitui o posto de trabalho que o projeto precisa ter. Cadastrar aqui não muda o que o acordo permite em cada projeto."
      />

      <Section title="Cadastrar voluntário(a)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nome">
            <input className={inputClass} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <input className={inputClass} value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <input className={inputClass} value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
          </Field>
          <Field label="Disponibilidade (horas/semana)">
            <input type="number" className={inputClass} value={novo.disponibilidadeHorasSemana} onChange={(e) => setNovo({ ...novo, disponibilidadeHorasSemana: e.target.value })} />
          </Field>
          <Field label="Habilidades (separadas por vírgula)" hint="Ex.: pedreiro, cozinha, redes sociais">
            <input className={inputClass} value={novo.habilidades} onChange={(e) => setNovo({ ...novo, habilidades: e.target.value })} />
          </Field>
          <Field label="Observações">
            <input className={inputClass} value={novo.observacoes} onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} />
          </Field>
        </div>
        <button onClick={adicionar} className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/15 px-3 py-1.5 text-sm hover:bg-[color:var(--sm-accent)]/25">
          + Adicionar voluntário(a)
        </button>
      </Section>

      <Section title={`Cadastrados (${voluntarios.length})`}>
        <Field label="Filtrar por habilidade">
          <input className={inputClass} value={filtroHabilidade} onChange={(e) => setFiltroHabilidade(e.target.value)} placeholder="Ex.: pedreiro" />
        </Field>
        <ul className="space-y-2">
          {listaFiltrada.map((v) => (
            <li key={v.id} className="rounded border border-[color:var(--sm-border)] p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{v.nome}</p>
                  <p className="text-xs text-[color:var(--sm-text-dim)]">
                    {v.telefone && `${v.telefone} · `}
                    {v.email && `${v.email} · `}
                    {v.disponibilidadeHorasSemana ? `${v.disponibilidadeHorasSemana}h/semana` : ""}
                  </p>
                  {(v.habilidades?.length ?? 0) > 0 && <p className="text-xs">Habilidades: {v.habilidades!.join(", ")}</p>}
                  {v.observacoes && <p className="text-xs text-[color:var(--sm-text-dim)]">{v.observacoes}</p>}
                </div>
                <button onClick={() => remover(v.id)} className="shrink-0 text-xs text-[color:var(--sm-red)]">
                  remover
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {projects.map((p) => {
                  const marcado = (v.projetosDeInteresse ?? []).includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => alternarInteresse(v.id, p.id)}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${marcado ? "border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20" : "border-[color:var(--sm-border)] hover:border-[color:var(--sm-accent)]"}`}
                    >
                      {marcado ? <Check size={11} strokeWidth={2} /> : <Plus size={11} strokeWidth={2} />}
                      {p.titulo || "(sem título)"}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
          {listaFiltrada.length === 0 && <li className="text-[color:var(--sm-text-dim)]">Nenhum voluntário cadastrado ainda.</li>}
        </ul>
      </Section>

      {projects.map((p) => {
        const sugeridos = sugerirVoluntariosParaProjeto(voluntarios, p);
        if (sugeridos.length === 0) return null;
        return (
          <Section key={p.id} title={`Voluntários sugeridos para "${p.titulo || "(sem título)"}"`}>
            <ul className="space-y-1 text-sm">
              {sugeridos.map((v) => (
                <li key={v.id}>
                  {v.nome} — {v.habilidades?.join(", ")}
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
