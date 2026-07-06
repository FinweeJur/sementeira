const ONBOARDING_KEY = "sementeira-onboarding-visto-v1";
const FONT_SCALE_KEY = "sementeira-font-scale-v1";
const SEED_AUTO_KEY = "sementeira-seed-auto-importado-v1";

/** Marca se os projetos de exemplo já foram colocados automaticamente na tela inicial — evita reimportar depois que o usuário os excluir de propósito. */
export function seedAutoImportado(): boolean {
  return localStorage.getItem(SEED_AUTO_KEY) === "1";
}
export function marcarSeedAutoImportado(): void {
  localStorage.setItem(SEED_AUTO_KEY, "1");
}

export function onboardingVisto(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "1";
}
export function marcarOnboardingVisto(): void {
  localStorage.setItem(ONBOARDING_KEY, "1");
}

export type FontScale = "pequena" | "normal" | "grande";
const ESCALAS: Record<FontScale, number> = { pequena: 0.9, normal: 1, grande: 1.15 };

export function carregarFontScale(): FontScale {
  const v = localStorage.getItem(FONT_SCALE_KEY);
  return v === "pequena" || v === "normal" || v === "grande" ? v : "normal";
}
export function salvarFontScale(scale: FontScale): void {
  localStorage.setItem(FONT_SCALE_KEY, scale);
  document.documentElement.style.setProperty("--sm-font-scale", String(ESCALAS[scale]));
}

export type Tema = "escuro" | "claro" | "alto-contraste";
const TEMA_KEY = "sementeira-tema-v1";
const TEMAS_VALIDOS: Tema[] = ["escuro", "claro", "alto-contraste"];

export function carregarTema(): Tema {
  const v = localStorage.getItem(TEMA_KEY);
  return (TEMAS_VALIDOS as string[]).includes(v ?? "") ? (v as Tema) : "escuro";
}
export function salvarTema(tema: Tema): void {
  localStorage.setItem(TEMA_KEY, tema);
  if (tema === "escuro") document.documentElement.removeAttribute("data-tema");
  else document.documentElement.setAttribute("data-tema", tema);
}
