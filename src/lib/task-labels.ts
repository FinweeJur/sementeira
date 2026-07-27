import { MessageCircle, Bot, RefreshCw, ShieldCheck, Search, Wand2, Upload, type LucideIcon } from "lucide-react";
import type { TipoTarefa } from "./task-context";

export const ICONE_TIPO: Record<TipoTarefa, LucideIcon> = {
  "copiloto-chat": MessageCircle,
  "agente-portfolio": Bot,
  "lapidacao-projeto": RefreshCw,
  "lapidacao-ecossistema": RefreshCw,
  "revisao-geral": RefreshCw,
  "revisao-ia": ShieldCheck,
  "analise-ecossistema": Search,
  "geracao-rascunho": Wand2,
  "importar-projeto": Upload,
  "pesquisa-web": Search,
};

export const ROTULO_TIPO: Record<TipoTarefa, string> = {
  "copiloto-chat": "Copiloto",
  "agente-portfolio": "Copiloto de projetos",
  "lapidacao-projeto": "Lapidação",
  "lapidacao-ecossistema": "Lapidação do ecossistema",
  "revisao-geral": "Revisão geral",
  "revisao-ia": "Revisão por IA",
  "analise-ecossistema": "Análise do ecossistema",
  "geracao-rascunho": "Geração de rascunho",
  "importar-projeto": "Importação de projeto",
  "pesquisa-web": "Pesquisa web",
};
