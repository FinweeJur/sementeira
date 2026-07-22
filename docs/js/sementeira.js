/* ============================================================
   Sementeira — comportamentos do site
   1. Holofote: brilho que segue o mouse em todo cartão/painel.
   2. Revelar ao rolar.
   Sem JS, tudo continua legível: o conteúdo já nasce visível
   (a classe .js é quem liga as animações).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. holofote ---------- */

  // Tudo que ganha o brilho ao passar o mouse.
  var ALVOS = [
    '.cartao', '.modelo', '.cenario', '.papel', '.passo-linha', '.passo-instalar',
    '.painel-regra', '.painel-ia', '.caixa-fala', '.faq-item', '.bloco',
    '.mock', '.selo-ico'
  ].join(',');

  var podeHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (podeHover && !reduzido) {
    // Injeta a camada de brilho em quem ainda não tem.
    var prepara = function (raiz) {
      var els = (raiz || document).querySelectorAll(ALVOS);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.querySelector(':scope > .holofote')) continue;
        var luz = document.createElement('div');
        luz.className = 'holofote';
        luz.setAttribute('aria-hidden', 'true');
        el.insertBefore(luz, el.firstChild);
      }
    };
    prepara(document);

    // Um único listener delegado: o brilho acompanha o cartão sob o cursor.
    // O retângulo do elemento fica em cache e só é medido de novo quando o
    // cursor troca de cartão, ou quando a página rola / muda de tamanho.
    var atual = null;
    var caixa = null;

    var apaga = function () {
      if (atual) atual.style.setProperty('--spot', '0');
      atual = null;
      caixa = null;
    };

    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var alvo = e.target && e.target.closest ? e.target.closest(ALVOS) : null;

      if (alvo !== atual) {
        apaga();
        if (!alvo) return;
        atual = alvo;
        caixa = alvo.getBoundingClientRect();
      } else if (!caixa) {
        caixa = alvo.getBoundingClientRect();
      }

      atual.style.setProperty('--mx', (e.clientX - caixa.left) + 'px');
      atual.style.setProperty('--my', (e.clientY - caixa.top) + 'px');
      atual.style.setProperty('--spot', '1');
    }, { passive: true });

    // Rolar ou redimensionar invalida a medida guardada.
    var invalida = function () { caixa = null; };
    window.addEventListener('scroll', invalida, { passive: true });
    window.addEventListener('resize', invalida, { passive: true });

    // Sai da janela: apaga o que estiver aceso.
    document.addEventListener('pointerleave', apaga);

    // <details> que abre muda de altura: garante a camada nos filhos novos.
    document.addEventListener('toggle', function (e) {
      if (e.target && e.target.tagName === 'DETAILS') prepara(e.target);
    }, true);
  }

  /* ---------- 2. revelar ao rolar ---------- */

  var itens = document.querySelectorAll('.revela');

  if (!('IntersectionObserver' in window) || reduzido) {
    for (var j = 0; j < itens.length; j++) itens[j].classList.add('visivel');
    return;
  }

  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('visivel');
      obs.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  for (var k = 0; k < itens.length; k++) obs.observe(itens[k]);
})();
