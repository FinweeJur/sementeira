import { useEffect, useState } from "react";
import { novoProjetoVazio, type Project } from "./lib/types";
import { loadProjects, upsertProject, deleteProject } from "./lib/storage";
import { ProjectList } from "./pages/ProjectList";
import { ProjectWizard } from "./pages/ProjectWizard";
import { Ecossistema } from "./pages/Ecossistema";
import { ClubeBeneficios } from "./pages/ClubeBeneficios";
import { Voluntarios } from "./pages/Voluntarios";
import { CompareProjects } from "./pages/CompareProjects";
import { Onboarding } from "./components/Onboarding";
import { NavBar } from "./components/NavBar";
import { TaskProvider } from "./lib/task-context";
import { TaskIndicator } from "./components/TaskIndicator";
import { TaskSidebar } from "./components/TaskSidebar";
import {
  onboardingVisto,
  marcarOnboardingVisto,
  carregarFontScale,
  salvarFontScale,
  carregarTema,
  salvarTema,
  seedAutoImportado,
  marcarSeedAutoImportado,
  type FontScale,
  type Tema,
} from "./lib/preferences";
import { carregarConfigLLM, salvarConfigLLM, type ProviderConfig } from "./lib/providers";
import { gerarProjetosSeed } from "./data/seed-projetos";
import { gerarClubeSeed } from "./data/seed-clube";
import { salvarClube } from "./lib/clube-beneficios";

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mostrarEcossistema, setMostrarEcossistema] = useState(false);
  const [mostrarClube, setMostrarClube] = useState(false);
  const [mostrarVoluntarios, setMostrarVoluntarios] = useState(false);
  const [mostrarComparacao, setMostrarComparacao] = useState(false);
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);
  const [sidebarTarefasAberta, setSidebarTarefasAberta] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>("normal");
  const [tema, setTema] = useState<Tema>("escuro");
  const [llmConfig, setLlmConfig] = useState<ProviderConfig>(carregarConfigLLM());

  useEffect(() => {
    let projetosCarregados = loadProjects();
    // Projetos de exemplo já vêm prontos na tela inicial, sem pedir confirmação — só uma vez, para não reimpor depois que o usuário os excluir de propósito.
    if (!seedAutoImportado()) {
      const seed = gerarProjetosSeed();
      let atualizados = projetosCarregados;
      for (const p of seed) atualizados = upsertProject(p);
      salvarClube(gerarClubeSeed(seed));
      marcarSeedAutoImportado();
      projetosCarregados = atualizados;
    }
    setProjects(projetosCarregados);
    setMostrarOnboarding(!onboardingVisto());
    const scale = carregarFontScale();
    setFontScale(scale);
    salvarFontScale(scale);
    const temaAtual = carregarTema();
    setTema(temaAtual);
    salvarTema(temaAtual);
  }, []);

  function handleTema(t: Tema) {
    setTema(t);
    salvarTema(t);
  }

  function handleLlmConfigChange(c: ProviderConfig) {
    setLlmConfig(c);
    salvarConfigLLM(c);
  }

  const current = projects.find((p) => p.id === openId) ?? null;

  function handleCreate(p: Project) {
    const updated = upsertProject(p);
    setProjects(updated);
    setOpenId(p.id);
  }

  function handleChange(p: Project) {
    const updated = upsertProject(p);
    setProjects(updated);
  }

  function handleDelete(id: string) {
    const updated = deleteProject(id);
    setProjects(updated);
    if (openId === id) setOpenId(null);
  }

  function handleRename(id: string, novoTitulo: string) {
    const alvo = projects.find((p) => p.id === id);
    if (!alvo) return;
    const updated = upsertProject({ ...alvo, titulo: novoTitulo, tituloEditadoManualmente: true });
    setProjects(updated);
  }

  function handleFontScale(scale: FontScale) {
    setFontScale(scale);
    salvarFontScale(scale);
  }

  function concluirOnboarding(comecarProjeto: boolean) {
    marcarOnboardingVisto();
    setMostrarOnboarding(false);
    // Do tutorial direto para a ação: o CTA final cria um projeto e abre no passo "Ideia".
    if (comecarProjeto) handleCreate(novoProjetoVazio());
  }

  if (mostrarOnboarding) {
    return <Onboarding onConcluir={concluirOnboarding} />;
  }

  let conteudo: React.ReactNode;
  if (current) {
    conteudo = (
      <ProjectWizard project={current} outrosProjetos={projects.filter((p) => p.id !== current.id)} onChange={handleChange} onVoltar={() => setOpenId(null)} />
    );
  } else if (mostrarEcossistema) {
    conteudo = (
      <Ecossistema
        projects={projects}
        onVoltar={() => setMostrarEcossistema(false)}
        onAtualizarProjeto={handleChange}
        onAbrirProjeto={(id) => {
          setMostrarEcossistema(false);
          setOpenId(id);
        }}
      />
    );
  } else if (mostrarClube) {
    conteudo = <ClubeBeneficios projects={projects} onVoltar={() => setMostrarClube(false)} />;
  } else if (mostrarVoluntarios) {
    conteudo = <Voluntarios projects={projects} onVoltar={() => setMostrarVoluntarios(false)} />;
  } else if (mostrarComparacao) {
    conteudo = (
      <CompareProjects
        projects={projects}
        onFechar={() => setMostrarComparacao(false)}
      />
    );
  } else {
    conteudo = (
      <ProjectList
        projects={projects}
        onOpen={setOpenId}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onRename={handleRename}
        onAtualizarProjeto={handleChange}
        onVerTutorial={() => setMostrarOnboarding(true)}
        onAbrirEcossistema={() => setMostrarEcossistema(true)}
        onAbrirClube={() => setMostrarClube(true)}
        onAbrirVoluntarios={() => setMostrarVoluntarios(true)}
        onAbrirComparacao={() => setMostrarComparacao(true)}
        llmConfig={llmConfig}
        onLlmConfigChange={handleLlmConfigChange}
      />
    );
  }

  return (
    <TaskProvider>
      <NavBar tema={tema} onTema={handleTema} fontScale={fontScale} onFontScale={handleFontScale} />
      {conteudo}
      <TaskIndicator onAbrir={() => setSidebarTarefasAberta(true)} />
      {sidebarTarefasAberta && (
        <TaskSidebar
          onFechar={() => setSidebarTarefasAberta(false)}
          onAbrirProjeto={(id) => {
            setSidebarTarefasAberta(false);
            setOpenId(id);
          }}
        />
      )}
    </TaskProvider>
  );
}
