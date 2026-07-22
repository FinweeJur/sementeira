/**
 * Holofote do mouse — versão discreta do efeito do site, só em .sm-card.
 * Um único listener delegado no documento (nada de listener por cartão).
 * Sem requestAnimationFrame: escreve as variáveis direto no handler, com o
 * getBoundingClientRect() do alvo em cache, invalidado no scroll/resize.
 */
export function iniciarHolofote(): () => void {
  let alvoAtual: HTMLElement | null = null;
  let rectAtual: DOMRect | null = null;

  function apagar(el: HTMLElement) {
    el.style.setProperty("--sm-spot", "0");
  }

  function onPointerMove(e: PointerEvent) {
    const alvo = (e.target as HTMLElement | null)?.closest<HTMLElement>(".sm-card") ?? null;

    // Guarda o caso "saiu de tudo" ANTES de comparar com o alvo anterior —
    // com os dois nulos, "alvo !== alvoAtual" é falso e cairia num
    // getBoundingClientRect() de null.
    if (!alvo) {
      if (alvoAtual) apagar(alvoAtual);
      alvoAtual = null;
      rectAtual = null;
      return;
    }

    if (alvo !== alvoAtual) {
      if (alvoAtual) apagar(alvoAtual);
      alvoAtual = alvo;
      rectAtual = alvo.getBoundingClientRect();
    }
    if (!rectAtual) rectAtual = alvo.getBoundingClientRect();

    alvo.style.setProperty("--sm-mx", `${e.clientX - rectAtual.left}px`);
    alvo.style.setProperty("--sm-my", `${e.clientY - rectAtual.top}px`);
    alvo.style.setProperty("--sm-spot", "1");
  }

  function invalidarRect() {
    rectAtual = null;
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("scroll", invalidarRect, { passive: true, capture: true });
  window.addEventListener("resize", invalidarRect, { passive: true });

  return () => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("scroll", invalidarRect, { capture: true });
    window.removeEventListener("resize", invalidarRect);
  };
}
