import { afterEach, describe, expect, it } from "vitest";
import { configuracaoLLMPronta, provedoresDisponiveis, type ProviderConfig } from "./providers";

/**
 * O ambiente é detectado pela presença da ponte IPC (`window.sementeira`). Nos
 * testes, jsdom não tem essa ponte — logo o padrão é "web". Para exercitar o
 * caminho do app instalado, a ponte é simulada.
 */
function simularAppInstalado() {
  (window as unknown as { sementeira?: unknown }).sementeira = { ping: async () => "pong" };
}

afterEach(() => {
  delete (window as unknown as { sementeira?: unknown }).sementeira;
});

const config = (extra: Partial<ProviderConfig> & { providerId: string }): ProviderConfig => extra;

describe("provedoresDisponiveis", () => {
  it("oferece o Servidor da Sementeira na web", () => {
    expect(provedoresDisponiveis().map((p) => p.id)).toContain("gateway");
  });

  it("esconde o Servidor da Sementeira no programa instalado, onde ele não serve para nada", () => {
    simularAppInstalado();
    expect(provedoresDisponiveis().map((p) => p.id)).not.toContain("gateway");
  });
});

describe("configuracaoLLMPronta", () => {
  it("recusa provedor inexistente", () => {
    expect(configuracaoLLMPronta(config({ providerId: "inventado" })).pronta).toBe(false);
  });

  it("aceita DeepSeek com chave, na web — a DeepSeek libera chamada do navegador", () => {
    expect(configuracaoLLMPronta(config({ providerId: "deepseek", apiKey: "sk-x" })).pronta).toBe(true);
  });

  it("recusa DeepSeek sem chave", () => {
    const r = configuracaoLLMPronta(config({ providerId: "deepseek" }));
    expect(r.pronta).toBe(false);
    expect(r.motivo).toMatch(/chave/i);
  });

  // O ponto central da versão web: a Maritaca recusa CORS do navegador.
  it("recusa a Maritaca na web mesmo com chave, e aponta a saída", () => {
    const r = configuracaoLLMPronta(config({ providerId: "maritaca", apiKey: "chave" }));
    expect(r.pronta).toBe(false);
    expect(r.motivo).toMatch(/Servidor da Sementeira/);
  });

  it("aceita a Maritaca com chave no programa instalado", () => {
    simularAppInstalado();
    expect(configuracaoLLMPronta(config({ providerId: "maritaca", apiKey: "chave" })).pronta).toBe(true);
  });

  it("exige modelo escolhido no Ollama", () => {
    expect(configuracaoLLMPronta(config({ providerId: "ollama" })).pronta).toBe(false);
    expect(configuracaoLLMPronta(config({ providerId: "ollama", model: "qwen2.5:7b" })).pronta).toBe(true);
  });

  it("exige token no Servidor da Sementeira, e não pede chave de provedor", () => {
    const semToken = configuracaoLLMPronta(config({ providerId: "gateway" }));
    expect(semToken.pronta).toBe(false);
    expect(semToken.motivo).toMatch(/token/i);
    // Só o token basta: as chaves dos provedores ficam no servidor.
    expect(configuracaoLLMPronta(config({ providerId: "gateway", apiKey: "tok" })).pronta).toBe(true);
  });

  // Modo público: "auto" (DeepSeek + reserva grátis) e "openrouter" dispensam token na web.
  it("na web, o Servidor no modo automático fica pronto sem token", () => {
    expect(configuracaoLLMPronta(config({ providerId: "gateway", provedorNoServidor: "auto" })).pronta).toBe(true);
  });

  it("na web, o Servidor com OpenRouter grátis fica pronto sem token", () => {
    expect(configuracaoLLMPronta(config({ providerId: "gateway", provedorNoServidor: "openrouter" })).pronta).toBe(true);
  });

  it("na web, DeepSeek DIRETO pelo servidor ainda exige token — não é rota pública", () => {
    const r = configuracaoLLMPronta(config({ providerId: "gateway", provedorNoServidor: "deepseek" }));
    expect(r.pronta).toBe(false);
    expect(r.motivo).toMatch(/token/i);
  });

  it("a dispensa de token vale só na web: no app instalado, gateway+auto ainda pediria token", () => {
    simularAppInstalado();
    const r = configuracaoLLMPronta(config({ providerId: "gateway", provedorNoServidor: "auto" }));
    expect(r.pronta).toBe(false);
    expect(r.motivo).toMatch(/token/i);
  });
});
