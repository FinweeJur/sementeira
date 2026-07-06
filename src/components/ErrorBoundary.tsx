import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  erro: Error | null;
}

/**
 * Sem isto, qualquer erro de render (ex.: no Mapa do Ecossistema) derruba a
 * árvore React inteira e deixa só o fundo escuro do app — o que aparece pro
 * usuário como uma "tela preta" sem explicação. Isola o erro e mostra um
 * caminho de volta em vez de travar o app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    console.error("Erro capturado pelo ErrorBoundary:", erro, info.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
          <p className="text-3xl">🌱⚠️</p>
          <h1 className="text-lg font-semibold">Algo deu errado nessa tela</h1>
          <p className="text-sm text-[color:var(--sm-text-dim)]">
            Seus projetos não foram perdidos — os dados ficam salvos independente desta tela. Detalhe técnico: {this.state.erro.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded border border-[color:var(--sm-accent)] bg-[color:var(--sm-accent)]/20 px-4 py-2 text-sm hover:bg-[color:var(--sm-accent)]/30"
          >
            Recarregar o app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
