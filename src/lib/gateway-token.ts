/**
 * Remonta o token do gateway a partir de 4 fragmentos embutidos no build
 * (invertidos e fora de ordem — ver .env.production.local). NÃO é segurança
 * real: quem abrir o bundle e ler este arquivo desfaz em segundos. É só mais
 * um obstáculo contra grep ingênuo por um token de 32 caracteres num arquivo
 * só. A proteção de verdade fica no servidor — rate limit por IP/global e
 * checagem de Origin, ver servidor/sementeira-servidor.cjs.
 */

function inverter(fragmento: string): string {
  return fragmento.split("").reverse().join("");
}

function env(chave: string): string {
  return (import.meta.env[chave] as string | undefined) ?? "";
}

// Ordem de remontagem != ordem de declaração no .env, de propósito.
const FRAGMENTOS = [env("VITE_SM_B"), env("VITE_SM_C"), env("VITE_SM_A"), env("VITE_SM_D")];

export function temTokenEmbutido(): boolean {
  return FRAGMENTOS.every((f) => f.length > 0);
}

export function montarTokenEmbutido(): string {
  if (!temTokenEmbutido()) return "";
  return FRAGMENTOS.map(inverter).join("");
}
