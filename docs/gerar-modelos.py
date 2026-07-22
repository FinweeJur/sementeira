# -*- coding: utf-8 -*-
"""Gera as páginas de modelo de projeto do site da Sementeira.

Uma página por modelo, mesmo design da landing (CSS/JS compartilhados),
mais a página de listagem em modelos/index.html.

Uso:  python docs/gerar-modelos.py

Para editar o texto de um modelo, mexa na lista MODELOS abaixo e rode de novo.
Ao mudar o CSS ou o JS, suba o ?v= das duas referências em CABECA — senão
quem já visitou o site continua com a versão antiga em cache.
"""
import os

SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "modelos")
os.makedirs(SAIDA, exist_ok=True)

# ícone decorativo por categoria (fonte "Ícones do Brasil")
ICONE = {
    "Infraestrutura": "u",
    "Alimentação": "b",
    "Tecnologia": "a",
    "Indústria": "t",
    "Energia": "h",
    "Logística": "n",
}

MODELOS = [
    {
        "slug": "fabrica-de-tijolos-ecologicos",
        "cat": "Infraestrutura",
        "titulo": "Fábrica de Tijolos Ecológicos",
        "resumo": "Tijolos feitos de terra e cimento, prensados a frio, para construir casas populares.",
        "oque": [
            "É uma pequena fábrica de tijolo feito com a terra do próprio lugar, misturada com um pouco de cimento.",
            "A prensa aperta a mistura e o tijolo sai pronto. Não precisa de forno nem de queimar lenha.",
            "O tijolo sai encaixado, então a parede sobe mais rápido e gasta menos massa.",
        ],
        "dano": "Casas perdidas e moradia cara. O tijolo feito perto baixa o custo de construir e reformar na região.",
        "precisa": [
            "Um terreno com galpão coberto e chão firme",
            "Prensa, betoneira e peneira",
            "Terra do lugar aprovada em teste simples de solo",
            "Uma equipe pequena, treinada para operar a prensa",
            "Um lugar seco para o tijolo curar antes de sair",
        ],
        "depois": "O tijolo é vendido para obras da região e para as próprias famílias atingidas. A fábrica se mantém com essa venda, desde que tenha obra acontecendo por perto.",
        "atencao": "A prensa se gasta com o uso. Se o orçamento não guardar dinheiro para consertar e trocar peça, o programa avisa: a conta do dia seguinte não fecha.",
    },
    {
        "slug": "empreiteira-popular",
        "cat": "Infraestrutura",
        "titulo": "Empreiteira Popular",
        "resumo": "Construção de casas e obras da comunidade, com gente da própria região trabalhando.",
        "oque": [
            "É um grupo organizado de pedreiros, serventes e mestres de obra da própria comunidade.",
            "Em vez de a obra vir de fora, quem constrói é quem mora ali. O dinheiro fica na região.",
            "Serve para casa, reforma, muro de contenção, poço, cerca, galpão da associação.",
        ],
        "dano": "Trabalho perdido e obras paradas. O grupo devolve renda para quem já sabia o ofício e ficou sem serviço.",
        "precisa": [
            "Ferramenta e equipamento de segurança para a equipe",
            "Um responsável técnico (engenheiro ou arquiteto) para assinar as obras",
            "Curso rápido de segurança no trabalho",
            "Um lugar para guardar material e ferramenta",
            "Contrato ou carteira em regra para quem trabalha",
        ],
        "depois": "Cada obra entregue paga a próxima. O grupo se mantém enquanto houver demanda de construção na região — inclusive das outras iniciativas de reparação.",
        "atencao": "Salário sem prazo e sem dizer de onde vem o dinheiro depois do repasse é uma das coisas que o acordo não deixa. O programa avisa e ajuda a amarrar a renda das obras.",
    },
    {
        "slug": "cozinha-industrial-solidaria",
        "cat": "Alimentação",
        "titulo": "Cozinha Industrial Solidária",
        "resumo": "Refeições e marmitas congeladas para famílias que estão passando aperto.",
        "oque": [
            "É uma cozinha grande, com estrutura para cozinhar em quantidade e congelar.",
            "Parte da comida vai de graça para famílias em situação difícil. Outra parte é vendida.",
            "Costuma gerar trabalho principalmente para mulheres da comunidade.",
        ],
        "dano": "Fome e perda de renda. A cozinha atende quem está passando necessidade e paga quem trabalha nela.",
        "precisa": [
            "Cozinha com pia, fogão industrial, coifa e bancada de inox",
            "Freezer e câmara fria para o congelado",
            "Alvará da vigilância sanitária",
            "Curso de manipulação de alimentos para a equipe",
            "Embalagem e etiqueta com data de validade",
        ],
        "depois": "A venda das marmitas cobre o custo das refeições doadas. Contratos com escolas, obras e empresas da região dão previsibilidade.",
        "atencao": "Conta de luz e de gás de uma cozinha industrial é alta. O programa lembra de colocar isso na conta antes de o projeto ir para a assembleia.",
    },
    {
        "slug": "fabrica-de-alimentos",
        "cat": "Alimentação",
        "titulo": "Fábrica de Alimentos",
        "resumo": "Pães, biscoitos, polpas de fruta e temperos feitos na comunidade.",
        "oque": [
            "É uma agroindústria pequena que transforma o que se planta perto em produto embalado.",
            "Fruta que ia estragar vira polpa. Mandioca vira farinha e biscoito. Tempero vira vidro na prateleira.",
            "Dá para começar com um produto só e crescer depois.",
        ],
        "dano": "Roça e criação perdidas. A fábrica dá destino ao que ainda se produz na região e paga melhor pela produção.",
        "precisa": [
            "Espaço limpo, com bancada e ponto de água",
            "Forno, despolpadeira ou moinho, conforme o produto",
            "Registro sanitário do produto",
            "Rótulo com informação nutricional",
            "Acordo de compra com quem planta",
        ],
        "depois": "A venda em feiras, mercados da região e programas de compra pública sustenta a produção. O lucro volta para quem planta e para quem trabalha na fábrica.",
        "atencao": "Produto de comida exige registro e rótulo certo. O programa coloca esse prazo no calendário para não travar a venda depois de tudo pronto.",
    },
    {
        "slug": "quintais-produtivos",
        "cat": "Alimentação",
        "titulo": "Quintais Produtivos",
        "resumo": "Horta sem terra, caixa d'água da chuva e criação de galinha no quintal de casa.",
        "oque": [
            "Em vez de uma horta grande num lugar só, cada família produz no próprio quintal.",
            "Junta três coisas: horta (inclusive sem terra, na água), caixa para guardar água de chuva e galinheiro.",
            "O que sobra de uma casa é trocado ou vendido para a vizinhança.",
        ],
        "dano": "Terra e água contaminadas, comida que não se pode mais tirar do lugar. O quintal devolve produção limpa perto de casa.",
        "precisa": [
            "Kit por família: estrutura da horta, bomba pequena e mudas",
            "Calha, cano e caixa para juntar a água da chuva",
            "Tela, comedouro e as primeiras aves",
            "Acompanhamento técnico nos primeiros meses",
            "Um ponto comum para juntar e vender o excedente",
        ],
        "depois": "O gasto de cada casa com comida cai. A venda do excedente entra como renda. Como o custo é dividido entre muitas famílias, o projeto aguenta bem o dia seguinte.",
        "atencao": "Projeto espalhado por muitas casas precisa de quem acompanhe. Sem isso, metade dos quintais para. O programa pede uma pessoa responsável por esse acompanhamento.",
    },
    {
        "slug": "piscicultura-tanque-rede",
        "cat": "Alimentação",
        "titulo": "Criação de Peixe",
        "resumo": "Peixe criado em tanque-rede, limpo e embalado ali mesmo para vender.",
        "oque": [
            "O peixe cresce dentro de tanques-rede, que são gaiolas grandes na água.",
            "Depois ele é limpo, cortado e embalado num barracão perto do tanque.",
            "Vende inteiro, em filé ou congelado.",
        ],
        "dano": "Pesca perdida. Muita gente vivia do rio e ficou sem. A criação devolve o peixe e o ofício.",
        "precisa": [
            "Água própria para criação, com laudo",
            "Licença ambiental e autorização para usar a água",
            "Tanques-rede, alevinos e ração",
            "Barracão de limpeza com câmara fria",
            "Curso de manejo e de abate humanitário",
        ],
        "depois": "A venda do peixe paga a ração e a equipe. Vender o peixe já limpo, e não vivo, aumenta bastante o que sobra.",
        "atencao": "A água do Paraopeba tem restrição por causa do rompimento. O programa marca este ponto como bloqueio até existir laudo e licença — é o primeiro item a resolver.",
    },
    {
        "slug": "centro-de-desenvolvimento-de-apps",
        "cat": "Tecnologia",
        "titulo": "Centro de Programação",
        "resumo": "Curso de programação para a juventude e apoio para criar aplicativos da comunidade.",
        "oque": [
            "É uma sala com computadores e internet onde a juventude aprende a programar.",
            "Depois do curso, os grupos criam soluções para a própria comunidade: site da associação, sistema de pedido, cadastro de família.",
            "Quem se forma consegue trabalhar de casa, para empresas de qualquer lugar.",
        ],
        "dano": "Jovens sem trabalho e sem estudo perto de casa. O centro abre uma porta que não depende de sair da região.",
        "precisa": [
            "Sala com computadores, energia estável e internet boa",
            "Professores ou parceria com uma escola técnica",
            "Material didático e licenças de programa",
            "Bolsa ou auxílio para o jovem conseguir frequentar",
            "Manutenção dos computadores",
        ],
        "depois": "Serviços prestados por quem se formou e parcerias com escolas e prefeituras mantêm o centro. Também é comum captar edital de formação.",
        "atencao": "Computador vira sucata em poucos anos. Se o projeto não previr troca de máquina, o programa mostra a conta furada no cenário pessimista.",
    },
    {
        "slug": "centro-de-comunicacao-popular",
        "cat": "Tecnologia",
        "titulo": "Centro de Comunicação Popular",
        "resumo": "Curso de rádio, vídeo e redes sociais, para a comunidade contar a própria história.",
        "oque": [
            "É um estúdio simples: microfone, câmera, luz e um computador para editar.",
            "Serve para gravar rádio, vídeo, podcast e material das assembleias.",
            "A comunidade passa a registrar a própria luta, sem depender de quem vem de fora.",
        ],
        "dano": "História apagada e informação que não chega. O centro devolve voz e registro para quem foi atingido.",
        "precisa": [
            "Sala com tratamento simples de som",
            "Microfone, câmera, luz e computador de edição",
            "Formação em gravação, edição e redes sociais",
            "Equipe pequena e fixa para manter a rotina",
            "Armazenamento seguro do que for gravado",
        ],
        "depois": "Cobertura de eventos, produção para prefeituras e sindicatos e edital de cultura mantêm a estrutura funcionando.",
        "atencao": "Comunicação não vende sozinha no começo. O programa costuma sugerir combinar com formação paga, para a conta fechar nos primeiros meses.",
    },
    {
        "slug": "estamparia-e-costura",
        "cat": "Indústria",
        "titulo": "Estamparia e Costura",
        "resumo": "Roupa, estampa e uniforme feitos por costureiras da região.",
        "oque": [
            "É um ateliê com máquinas de costura e uma estamparia.",
            "Faz uniforme de escola, camisa de evento, sacola e roupa para vender.",
            "Aproveita quem já sabe costurar e nunca teve máquina nem encomenda.",
        ],
        "dano": "Perda de renda, principalmente entre mulheres. O ateliê transforma um ofício que já existe em trabalho com encomenda garantida.",
        "precisa": [
            "Sala com boa luz e tomadas suficientes",
            "Máquinas reta, overloque e galoneira",
            "Prensa e material de estamparia",
            "Tecido e aviamento para começar",
            "Uma pessoa que cuide de encomenda e prazo",
        ],
        "depois": "Uniforme escolar e encomenda de empresa e prefeitura dão volume constante. A venda de roupa própria completa a renda.",
        "atencao": "Encomenda grande com prazo curto quebra ateliê pequeno. O programa pede um cronograma realista antes de fechar contrato.",
    },
    {
        "slug": "galpao-de-reciclagem-e-artesanato",
        "cat": "Indústria",
        "titulo": "Galpão de Reciclagem",
        "resumo": "Separação de material reciclável e artesanato feito com o que seria jogado fora.",
        "oque": [
            "É um galpão onde o material recolhido é separado, prensado e vendido.",
            "Uma parte vira artesanato e móvel, que valem bem mais do que o material solto.",
            "Organiza um trabalho que muita gente já fazia sozinha, na rua.",
        ],
        "dano": "Renda perdida e lixo acumulado. O galpão dá estrutura, segurança e preço melhor para quem já catava.",
        "precisa": [
            "Galpão coberto com espaço para separar",
            "Prensa, balança e carrinho",
            "Equipamento de proteção para a equipe",
            "Acordo com a prefeitura sobre a coleta",
            "Comprador certo para cada tipo de material",
        ],
        "depois": "A venda do material prensado paga a rotina. O artesanato entra como renda extra e ajuda nos meses de preço baixo.",
        "atencao": "O preço do reciclável sobe e desce muito. O programa roda o cenário pessimista com preço baixo, para a comunidade ver o aperto antes de ele acontecer.",
    },
    {
        "slug": "usina-solar-comunitaria",
        "cat": "Energia",
        "titulo": "Usina Solar Comunitária",
        "resumo": "Placas de sol que geram energia para a comunidade. O que sobra é vendido.",
        "oque": [
            "São placas solares instaladas num terreno ou num telhado grande.",
            "A energia gerada abate a conta de luz das casas e dos projetos que participam.",
            "O que sobra é injetado na rede e vira crédito ou dinheiro.",
        ],
        "dano": "Conta de luz pesada e famílias descapitalizadas. A usina baixa uma despesa fixa de todo mundo.",
        "precisa": [
            "Terreno ou telhado com sol o dia todo e documentação em ordem",
            "Placas, inversores e estrutura de fixação",
            "Projeto elétrico e aprovação da distribuidora",
            "Empresa habilitada para instalar",
            "Limpeza e manutenção periódica das placas",
        ],
        "depois": "A economia na conta de luz e a venda do excedente sustentam a usina. É um dos modelos com o dia seguinte mais previsível.",
        "atencao": "O acordo não permite pagar conta de consumo individual de família. Aqui a energia é da estrutura coletiva — o programa checa esse limite linha por linha.",
    },
    {
        "slug": "transportadora-popular",
        "cat": "Logística",
        "titulo": "Transportadora Popular",
        "resumo": "Transporte de gente e de carga, ligando as comunidades entre os municípios.",
        "oque": [
            "São veículos da própria comunidade levando pessoas, produto e material entre os municípios da bacia.",
            "Atende quem precisa ir ao médico, à escola ou à cidade e não tem condução.",
            "Também leva a produção dos outros projetos até o comprador.",
        ],
        "dano": "Comunidades isoladas e produção parada por falta de condução. O transporte liga de novo o que a lama separou.",
        "precisa": [
            "Veículo adequado e documentação em dia",
            "Motoristas habilitados na categoria certa",
            "Autorização do órgão de trânsito para transporte de passageiro",
            "Seguro e plano de manutenção",
            "Rota e horário combinados com as comunidades",
        ],
        "depois": "Frete dos outros projetos, transporte contratado e linhas com horário fixo mantêm o serviço rodando.",
        "atencao": "Veículo desvaloriza e quebra. O programa inclui a depreciação e um fundo de manutenção — sem isso o projeto para no primeiro conserto grande.",
    },
]

CABECA = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{titulo_pagina}</title>
<meta name="description" content="{descricao}" />
<meta property="og:title" content="{titulo_pagina}" />
<meta property="og:description" content="{descricao}" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="pt_BR" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>%F0%9F%8C%B1</text></svg>" />
<link rel="preconnect" href="https://api.fontshare.com" />
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=panchang@600,700&f[]=chillax@500,600&f[]=synonym@400,500,600&display=swap" />
<link rel="stylesheet" href="../css/sementeira.css?v=2" />
<script>document.documentElement.classList.add('js');</script>
</head>
<body>

<a class="pular" href="#conteudo">Pular para o conteúdo</a>

<nav class="nav">
  <a class="marca" href="../index.html">
    <span class="marca-selo" aria-hidden="true">&#127793;</span>
    <span class="marca-nome">Sementeira</span>
  </a>
  <div class="nav-dir">
    <div class="nav-links">
      <a href="../index.html#como-funciona">Como funciona</a>
      <a href="../index.html#avisos">O que ela avisa</a>
      <a href="index.html" class="ativo">Modelos</a>
      <a href="../index.html#perguntas">Perguntas</a>
    </div>
    <a class="btn btn-principal" href="../baixar.html">Baixar</a>
  </div>
</nav>
"""

RODAPE = """
<footer>
  <div class="wrap rodape-grade">
    <div>
      <a class="marca" href="../index.html">
        <span class="marca-selo" aria-hidden="true">&#127793;</span>
        <span class="marca-nome">Sementeira</span>
      </a>
      <p class="rodape-sobre">
        Da ideia à repara&ccedil;&atilde;o. Programa de computador que ajuda quem foi atingido pela barragem de Brumadinho
        a montar projetos da comunidade.
      </p>
    </div>

    <div>
      <h3>O programa</h3>
      <div class="rodape-col">
        <a href="../index.html#como-funciona">Como funciona</a>
        <a href="../index.html#avisos">O que ela avisa</a>
        <a href="index.html">Modelos de projeto</a>
        <a href="../index.html#perguntas">Perguntas e respostas</a>
        <a href="../baixar.html">Baixar</a>
      </div>
    </div>

    <div>
      <h3>Movimento</h3>
      <div class="rodape-col">
        <a href="https://mab.org.br">mab.org.br</a>
        <span>A luta pela repara&ccedil;&atilde;o integral</span>
      </div>
    </div>

    <div>
      <h3>Projeto</h3>
      <div class="rodape-col">
        <a href="https://github.com/FinweeJur/sementeira">C&oacute;digo no GitHub</a>
        <a href="../apresentacao-sementeira.pdf">Apresenta&ccedil;&atilde;o em PDF</a>
        <span>Vers&atilde;o 0.2.0 &middot; Windows</span>
      </div>
    </div>
  </div>

  <div class="wrap rodape-fim">
    <span>&copy; 2026 Artur Colito &middot; todos os direitos reservados</span>
    <span>Ferramenta independente. N&atilde;o substitui a Governan&ccedil;a Popular, as Comiss&otilde;es de Atingidos ou as assembleias.</span>
  </div>
</footer>

<script src="../js/sementeira.js?v=2"></script>
</body>
</html>
"""


def pagina_modelo(m, anterior, proximo):
    ico = ICONE[m["cat"]]
    oque = "\n".join("        <p>%s</p>" % p for p in m["oque"])
    precisa = "\n".join("          <li>%s</li>" % p for p in m["precisa"])

    nav_pares = []
    if anterior:
        nav_pares.append(
            '<a class="btn btn-vazado" href="%s.html">&larr; %s</a>' % (anterior["slug"], anterior["titulo"])
        )
    if proximo:
        nav_pares.append(
            '<a class="btn btn-vazado" href="%s.html">%s &rarr;</a>' % (proximo["slug"], proximo["titulo"])
        )
    vizinhos = "\n        ".join(nav_pares)

    corpo = """
<header class="pagina-topo tem-marca">
  <div class="marca-dagua" style="right:-40px; bottom:-70px;" aria-hidden="true"><span class="ico">{ico}</span></div>
  <div class="wrap-estreito">
    <p class="migalhas"><a href="../index.html">In&iacute;cio</a> &rsaquo; <a href="index.html">Modelos</a> &rsaquo; {titulo}</p>
    <span class="etiqueta">{cat}</span>
    <h1>{titulo}</h1>
    <p class="linha-secao">{resumo}</p>
  </div>
</header>

<main id="conteudo">

<section class="pad">
  <div class="wrap-estreito">
    <div class="modelo-capa revela">
      <img src="../img/modelos/{slug}.jpg" alt="Ilustra&ccedil;&atilde;o do modelo {titulo}" width="760" height="424" />
    </div>

    <div class="grade" style="margin-top:32px;">
      <div class="bloco revela">
        <h2>O que &eacute;</h2>
{oque}
      </div>

      <div class="bloco revela">
        <h2>Que dano ele ajuda a reparar</h2>
        <p>{dano}</p>
      </div>

      <div class="bloco revela">
        <h2>O que costuma precisar</h2>
        <ul class="lista-check">
{precisa}
        </ul>
        <p style="margin-top:16px; font-size:15px; color:var(--faint);">
          Os valores de cada item entram no programa, com pesquisa de pre&ccedil;o quando h&aacute; internet.
        </p>
      </div>

      <div class="bloco revela">
        <h2>E depois que o dinheiro acabar?</h2>
        <p>{depois}</p>
      </div>

      <div class="painel-regra revela" style="margin-top:0;">
        <div class="painel-topo">
          <span class="painel-nome"><span class="losango" style="width:12px; height:12px;" aria-hidden="true"></span> Aten&ccedil;&atilde;o neste modelo</span>
        </div>
        <p>{atencao}</p>
      </div>
    </div>

    <p class="nota-pe revela">
      Este modelo &eacute; um ponto de partida, n&atilde;o uma receita fechada. A comunidade muda o que quiser,
      e o programa refaz as contas junto.
    </p>
  </div>
</section>

<section class="pad faixa-alt">
  <div class="wrap-estreito" style="text-align:center;">
    <div class="selo-ico revela" style="margin:0 auto 18px; display:flex;" aria-hidden="true"><span class="ico">{ico}</span></div>
    <h2 class="titulo-secao revela">Quer come&ccedil;ar por este modelo?</h2>
    <p class="linha-secao revela" style="margin:0 auto 32px;">
      Baixe a Sementeira, escreva a sua ideia e escolha este modelo. O resto o programa preenche com voc&ecirc;.
    </p>
    <div class="cta-dupla revela" style="justify-content:center;">
      <a class="btn btn-principal btn-grande" href="../baixar.html">&#11015; Baixar o programa</a>
      <a class="btn btn-vazado" href="index.html">Ver todos os modelos</a>
    </div>
  </div>
</section>

<section class="pad">
  <div class="wrap-estreito">
    <p class="olho revela">Outros modelos</p>
    <div class="cta-dupla revela">
        {vizinhos}
    </div>
  </div>
</section>

</main>
""".format(
        ico=ico,
        titulo=m["titulo"],
        cat=m["cat"],
        resumo=m["resumo"],
        slug=m["slug"],
        oque=oque,
        dano=m["dano"],
        precisa=precisa,
        depois=m["depois"],
        atencao=m["atencao"],
        vizinhos=vizinhos,
    )

    html = CABECA.format(
        titulo_pagina="%s — modelo de projeto | Sementeira" % m["titulo"],
        descricao=m["resumo"],
    ) + corpo + RODAPE
    return html


def pagina_indice():
    cartoes = []
    for m in MODELOS:
        cartoes.append("""      <a class="modelo revela" href="{slug}.html">
        <div class="modelo-foto"><img src="../img/modelos/{slug}.jpg" alt="" loading="lazy" width="760" height="424" /></div>
        <div class="modelo-corpo">
          <span class="etiqueta">{cat}</span>
          <h3>{titulo}</h3>
          <p>{resumo}</p>
          <span class="explorar">Ver o modelo <span class="seta" aria-hidden="true">&rarr;</span></span>
        </div>
      </a>""".format(**m))

    corpo = """
<header class="pagina-topo tem-marca">
  <div class="marca-dagua" style="right:-40px; bottom:-70px;" aria-hidden="true"><span class="ico">a</span></div>
  <div class="wrap-estreito">
    <p class="migalhas"><a href="../index.html">In&iacute;cio</a> &rsaquo; Modelos</p>
    <div class="selo-ico" aria-hidden="true"><span class="ico">a</span></div>
    <h1>J&aacute; temos algumas ideias prontas para come&ccedil;ar</h1>
    <p class="linha-secao">
      Escolha a que mais parece com a sua e mude o que precisar.
      Ou comece do zero: se a sua ideia n&atilde;o estiver aqui, &eacute; s&oacute; escrever e a Sementeira monta o projeto do mesmo jeito.
    </p>
  </div>
</header>

<main id="conteudo">

<section class="pad">
  <div class="wrap">
    <div class="grade grade-modelos">
{cartoes}
    </div>

    <p class="aviso-verde revela">
      <span class="bolinha" aria-hidden="true"></span>
      N&atilde;o achou a sua ideia? Melhor ainda. Escreva do seu jeito na primeira tela e o programa monta o projeto a partir dela.
    </p>
  </div>
</section>

<section class="pad faixa-alt" style="text-align:center;">
  <div class="wrap-estreito">
    <h2 class="titulo-secao revela">A sua ideia tamb&eacute;m vira projeto</h2>
    <p class="linha-secao revela" style="margin:0 auto 32px;">
      Os modelos existem para poupar trabalho, n&atilde;o para limitar. Quem conhece a necessidade da comunidade &eacute; a comunidade.
    </p>
    <div class="cta-dupla revela" style="justify-content:center;">
      <a class="btn btn-principal btn-grande" href="../baixar.html">&#11015; Baixar o programa</a>
      <a class="btn btn-vazado" href="../index.html#perguntas">Ainda tenho d&uacute;vidas</a>
    </div>
  </div>
</section>

</main>
""".format(cartoes="\n".join(cartoes))

    return CABECA.format(
        titulo_pagina="Modelos de projeto | Sementeira",
        descricao="Doze modelos de projeto comunitário para a bacia do Paraopeba. Escolha o mais parecido com a sua ideia — ou comece do zero.",
    ) + corpo + RODAPE


for i, m in enumerate(MODELOS):
    ant = MODELOS[i - 1] if i > 0 else None
    prox = MODELOS[i + 1] if i < len(MODELOS) - 1 else None
    caminho = os.path.join(SAIDA, m["slug"] + ".html")
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(pagina_modelo(m, ant, prox))
    print("ok", m["slug"] + ".html")

with open(os.path.join(SAIDA, "index.html"), "w", encoding="utf-8") as f:
    f.write(pagina_indice())
print("ok index.html")
print("total:", len(os.listdir(SAIDA)), "arquivos")
