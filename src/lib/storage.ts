import type { EquipeMembro, Project } from "./types";

const PROJECTS_KEY = "sementeira-projects-v1";

/** `equipe` era `string[]` antes desta versão — converte cada string antiga em um membro estruturado mínimo, sem perder o texto já digitado. */
function migrarEquipe(equipe: unknown): EquipeMembro[] {
  if (!Array.isArray(equipe)) return [];
  return equipe.map((item) => (typeof item === "string" ? { id: crypto.randomUUID(), nome: item } : (item as EquipeMembro)));
}

/** Preenche campos adicionados depois que o projeto já existia salvo — evita quebrar ao carregar dados antigos do localStorage. */
function migrarProjeto(project: Project): Project {
  return {
    ...project,
    riscos: project.riscos ?? [],
    posCompleto: project.posCompleto ?? {},
    observacoesEcossistema: project.observacoesEcossistema ?? [],
    planoImplementacao: project.planoImplementacao ?? [],
    espacoLogistica: project.espacoLogistica ?? {},
    versaoLapidacao: project.versaoLapidacao ?? 0,
    historicoVersoes: project.historicoVersoes ?? [],
    equipe: migrarEquipe(project.equipe),
    cronogramaMensal: project.cronogramaMensal ?? [],
    indicadores: project.indicadores ?? [],
  };
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const projects = JSON.parse(raw) as Project[];
    return projects.map(migrarProjeto);
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function upsertProject(project: Project): Project[] {
  const projects = loadProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  const updated = { ...project, atualizadoEm: new Date().toISOString() };
  if (idx >= 0) {
    projects[idx] = updated;
  } else {
    projects.push(updated);
  }
  saveProjects(projects);
  return projects;
}

export function deleteProject(id: string): Project[] {
  const projects = loadProjects().filter((p) => p.id !== id);
  saveProjects(projects);
  return projects;
}
