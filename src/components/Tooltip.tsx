import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Tooltip de hover/accessível — aparece ao passar o mouse ou focar (teclado),
 * desaparece ao tirar o mouse ou desfocar. Usa position:fixed calculado via
 * getBoundingClientRect para evitar clipping por overflow:hidden de containers.
 * Fecha com Escape. Respeita prefers-reduced-motion (sem animação de fade).
 */
export function Tooltip({ texto, children, posicao = "top" }: { texto: string; children: ReactNode; posicao?: "top" | "bottom" }) {
  const [visivel, setVisivel] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const calcularPosicao = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    let top: number;
    if (posicao === "bottom") {
      top = triggerRect.bottom + 6;
    } else {
      top = triggerRect.top - popoverRect.height - 6;
    }

    const left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;

    popover.style.top = `${Math.max(4, top)}px`;
    popover.style.left = `${Math.max(4, Math.min(left, window.innerWidth - popoverRect.width - 4))}px`;
  }, [posicao]);

  useEffect(() => {
    if (visivel) calcularPosicao();
  }, [visivel, calcularPosicao]);

  useEffect(() => {
    if (!visivel) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setVisivel(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visivel]);

  useEffect(() => {
    if (!visivel) return;
    function onScroll() { setVisivel(false); }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [visivel]);

  return (
    <span
      ref={triggerRef}
      className="sm-tooltip-trigger"
      onMouseEnter={() => setVisivel(true)}
      onMouseLeave={() => setVisivel(false)}
      onFocus={() => setVisivel(true)}
      onBlur={() => setVisivel(false)}
    >
      {children}
      {visivel && (
        <div ref={popoverRef} role="tooltip" className="sm-tooltip">
          {texto}
        </div>
      )}
    </span>
  );
}
