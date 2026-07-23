import { useEffect, useState } from "react";
import { novoProjetoVazio, type Project } from "./lib/types";
import { loadProjects, upsertProject, deleteProject } from "./lib/storage";
import { ProjectList } from "./pages/ProjectList";
import { ProjectWizard } from "./pages/ProjectWizard";
import { Ecossistema } from "./pages/Ecossistema";
import { ClubeBeneficios } from "./pages/ClubeBeneficios";
import { Voluntarios } from "./pages/Voluntarios";
import { Biblioteca } from "./pages/Biblioteca";
import { CompareProjects } from "./pages/CompareProjects";
import { Onboarding } from "./components/Onboarding";
import { NavBar } from "./components/NavBar";
import { TaskProvider } from "./lib/task-context";
import { TaskIndicator } from "./components/TaskIndicator";
import { TaskSidebar } from "./components/TaskSidebar";
import { AgentePortfolioChat } from "./components/AgentePortfolioChat";
import { RevisaoGeralModal } from "./components/RevisaoGeralModal";
import { ImportarProjetoModal } from "./components/ImportarProjetoModal";
import { SettingsModal } from "./components/SettingsModal";
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
import { iniciarHolofote } from "./lib/holofote";

/**
 * A tela que está no ar. Era um conjunto de seis booleanos mutuamente
 * exclusivos mais o `openId`, resolvido por uma cadeia `if/else if` — e como
 * o projeto aberto vinha primeiro nessa cadeia, clicar em Biblioteca, Clube
 * ou Cadastro com um projeto aberto ligava a bandeira e não mudava nada na
 * tela. Com um estado só, dois destinos ao mesmo tempo deixam de existir.
 *
 * Só telas entram aqui. Sobreposições (Copiloto, importação, Configurações,
 * tarefas) continuam separadas de propósito: elas convivem com qualquer tela.
 */
type Tela =
  | { nome: "portfolio" }
  | { nome: "projeto"; id: string }
  | { nome: "ecossistema" }
  | { nome: "clube" }
  | { nome: "voluntarios" }
  | { nome: "biblioteca" }
  | { nome: "comparacao" };

const PORTFOLIO: Tela = { nome: "portfolio" };

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tela, setTela] = useState<Tela>(PORTFOLIO);
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);
  const [sidebarTarefasAberta, setSidebarTarefasAberta] = useState(false);
  const [agenteAberto, setAgenteAberto] = useState(false);
  const [revisaoGeralAberta, setRevisaoGeralAberta] = useState(false);
  const [importarAberta, setImportarAberta] = useState(false);
  // Configurações moram aqui, e não no ProjectList, porque o modal de
  // importação é irmão dele na árvore e precisa conseguir abrir as
  // Configurações quando avisa que falta configurar a IA.
  const [configAberta, setConfigAberta] = useState(false);
  const [focarModelo, setFocarModelo] = useState(false);
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

  useEffect(() => iniciarHolofote(), []);

  function handleTema(t: Tema) {
    setTema(t);
    salvarTema(t);
  }

  function handleLlmConfigChange(c: ProviderConfig) {
    setLlmConfig(c);
    salvarConfigLLM(c);
  }

  const current = tela.nome === "projeto" ? (projects.find((p) => p.id === tela.id) ?? null) : null;

  function abrirProjeto(id: string) {
    setTela({ nome: "projeto", id });
  }

  function voltarAoPortfolio() {
    setTela(PORTFOLIO);
  }

  function handleCreate(p: Project) {
    const updated = upsertProject(p);
    setProjects(updated);
    abrirProjeto(p.id);
  }

  function handleChange(p: Project) {
    const updated = upsertProject(p);
    setProjects(updated);
  }

  function handleDelete(id: string) {
    const updated = deleteProject(id);
    setProjects(updated);
    if (tela.nome === "projeto" && tela.id === id) voltarAoPortfolio();
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

  function renderizarPortfolio(): React.ReactNode {
    return (
      <ProjectList
        projects={projects}
        onOpen={abrirProjeto}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onRename={handleRename}
        onAtualizarProjeto={handleChange}
        onVerTutorial={() => setMostrarOnboarding(true)}
        onImportar={() => setImportarAberta(true)}
        onAbrirComparacao={() => setTela({ nome: "comparacao" })}
        onAbrirEcossistema={() => setTela({ nome: "ecossistema" })}
        onAbrirCopiloto={() => setAgenteAberto(true)}
        onAbrirRevisaoGeral={() => setRevisaoGeralAberta(true)}
        onAbrirBiblioteca={() => setTela({ nome: "biblioteca" })}
        onAbrirClube={() => setTela({ nome: "clube" })}
        onAbrirVoluntarios={() => setTela({ nome: "voluntarios" })}
        onAbrirConfig={() => setConfigAberta(true)}
        llmConfig={llmConfig}
      />
    );
  }

  function renderizarTela(): React.ReactNode {
    switch (tela.nome) {
      case "projeto":
        // Projeto excluído por outra via: cai no portfólio em vez de tela vazia.
        if (!current) return renderizarPortfolio();
        return (
          <ProjectWizard
            project={current}
            outrosProjetos={projects.filter((p) => p.id !== current.id)}
            onChange={handleChange}
            onVoltar={voltarAoPortfolio}
          />
        );
      case "ecossistema":
        return <Ecossistema projects={projects} onVoltar={voltarAoPortfolio} onAtualizarProjeto={handleChange} onAbrirProjeto={abrirProjeto} />;
      case "clube":
        return <ClubeBeneficios projects={projects} onVoltar={voltarAoPortfolio} />;
      case "voluntarios":
        return <Voluntarios projects={projects} onVoltar={voltarAoPortfolio} />;
      case "biblioteca":
        return <Biblioteca onVoltar={voltarAoPortfolio} />;
      case "comparacao":
        return <CompareProjects projects={projects} onFechar={voltarAoPortfolio} />;
      case "portfolio":
        return renderizarPortfolio();
    }
  }

  return (
    <TaskProvider>
      <NavBar
        tema={tema}
        onTema={handleTema}
        fontScale={fontScale}
        onFontScale={handleFontScale}
        temProjeto={projects.length > 0}
        temMultiplosProjetos={projects.length > 1}
        onNovoProjeto={() => handleCreate(novoProjetoVazio())}
        onImportar={() => setImportarAberta(true)}
        onComparar={() => setTela({ nome: "comparacao" })}
        onEcossistema={() => setTela({ nome: "ecossistema" })}
        onCopiloto={() => setAgenteAberto(true)}
        onRevisaoGeral={() => setRevisaoGeralAberta(true)}
        onBiblioteca={() => setTela({ nome: "biblioteca" })}
        onClube={() => setTela({ nome: "clube" })}
        onVoluntarios={() => setTela({ nome: "voluntarios" })}
      />
      {renderizarTela()}
      <TaskIndicator onAbrir={() => setSidebarTarefasAberta(true)} />
      {sidebarTarefasAberta && (
        <TaskSidebar
          onFechar={() => setSidebarTarefasAberta(false)}
          onAbrirProjeto={(id) => {
            setSidebarTarefasAberta(false);
            abrirProjeto(id);
          }}
        />
      )}
      {importarAberta && (
        <ImportarProjetoModal
          onCreate={handleCreate}
          onFechar={() => setImportarAberta(false)}
          onAbrirConfigModelo={() => {
            setFocarModelo(true);
            setConfigAberta(true);
          }}
        />
      )}
      {agenteAberto && (
        <AgentePortfolioChat projects={projects} onAtualizarProjeto={handleChange} onAbrirProjeto={abrirProjeto} onClose={() => setAgenteAberto(false)} />
      )}
      {revisaoGeralAberta && (
        <RevisaoGeralModal
          projects={projects}
          onAtualizarProjeto={handleChange}
          onClose={() => setRevisaoGeralAberta(false)}
          onAbrirEcossistema={() => setTela({ nome: "ecossistema" })}
          onAbrirClube={() => setTela({ nome: "clube" })}
        />
      )}
      {/* Por último de propósito: precisa ficar acima do modal de importação,
          que continua aberto atrás enquanto a pessoa configura o modelo. */}
      {configAberta && (
        <SettingsModal
          config={llmConfig}
          onChange={handleLlmConfigChange}
          focarModelo={focarModelo}
          onFechar={() => {
            setConfigAberta(false);
            setFocarModelo(false);
          }}
        />
      )}
    </TaskProvider>
  );
}
