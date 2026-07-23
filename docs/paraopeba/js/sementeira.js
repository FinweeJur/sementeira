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

  // Duas camadas independentes. A de seção acende junto com a de cartão,
  // então o mouse ilumina a página inteira, e não só o cartão sob o cursor.
  // O desenho de cada camada é ::after (cartões) e ::before (seções), no CSS.
  var CAMADAS = [
    {
      sel: '.cartao,.modelo,.cenario,.papel,.passo-linha,.passo-instalar,' +
           '.painel-regra,.painel-ia,.caixa-fala,.faq-item,.bloco,.mock,.selo-ico',
      x: '--mx', y: '--my', ligado: '--spot',
      atual: null, caixa: null
    },
    {
      sel: 'section,header.hero,header.pagina-topo',
      x: '--mx-secao', y: '--my-secao', ligado: '--spot-secao',
      atual: null, caixa: null
    }
  ];

  var podeHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (podeHover && !reduzido) {
    var apaga = function (c) {
      if (c.atual) c.atual.style.setProperty(c.ligado, '0');
      c.atual = null;
      c.caixa = null;
    };

    // Um listener só, delegado, cuidando das duas camadas.
    // O retângulo fica em cache e só é medido de novo quando o cursor troca
    // de elemento, ou quando a página rola / muda de tamanho.
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      if (!e.target || !e.target.closest) return;

      for (var i = 0; i < CAMADAS.length; i++) {
        var c = CAMADAS[i];
        var alvo = e.target.closest(c.sel);

        // Fora de qualquer alvo desta camada: apaga e passa adiante.
        // Precisa vir antes da comparação — com alvo e atual ambos nulos,
        // "alvo !== c.atual" é falso e o código seguiria com c.atual nulo.
        if (!alvo) { apaga(c); continue; }

        if (alvo !== c.atual) { apaga(c); c.atual = alvo; }
        if (!c.caixa) c.caixa = alvo.getBoundingClientRect();

        alvo.style.setProperty(c.x, (e.clientX - c.caixa.left) + 'px');
        alvo.style.setProperty(c.y, (e.clientY - c.caixa.top) + 'px');
        alvo.style.setProperty(c.ligado, '1');
      }
    }, { passive: true });

    // Rolar ou redimensionar invalida as medidas guardadas.
    var invalida = function () {
      for (var i = 0; i < CAMADAS.length; i++) CAMADAS[i].caixa = null;
    };
    window.addEventListener('scroll', invalida, { passive: true });
    window.addEventListener('resize', invalida, { passive: true });

    // Sai da janela: apaga tudo que estiver aceso.
    document.addEventListener('pointerleave', function () {
      for (var i = 0; i < CAMADAS.length; i++) apaga(CAMADAS[i]);
    });
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
