import { CabecalhoSecao } from "../components/CabecalhoSecao";
import { Section } from "../components/Section";

const CONTATO = "contato@sementeiraprojetos.com.br";
const ATUALIZADO_EM = "26/07/2026";

export function PoliticaPrivacidade({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <button onClick={onVoltar} className="text-sm text-[color:var(--sm-text-dim)] hover:text-[color:var(--sm-text)]">
        ← Meus projetos
      </button>

      <CabecalhoSecao
        icone="h"
        olho="Transparência"
        titulo="Política de Privacidade"
        apoio={`Como a Sementeira trata os dados de quem usa o app, em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). Última atualização: ${ATUALIZADO_EM}.`}
      />

      <Section title="1. Resumo em português simples">
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          A regra da Sementeira é: <strong className="text-[color:var(--sm-text)]">os dados dos seus projetos ficam só no seu navegador</strong> — não existe
          conta, login, nem banco de dados nosso guardando o que você escreve. As únicas exceções são: (1) quando você usa a IA, o texto do projeto é enviado
          para o provedor escolhido; e (2) quando você mesmo clica em "compartilhar" num projeto, num voluntário ou numa oferta do Clube de Benefícios, aí
          sim aquilo vai pra um banco de dados público do servidor — sempre com um aviso antes, nunca automático, e guardado por até 5 anos (ver item 6).
        </p>
      </Section>

      <Section title="2. Quem é o controlador dos dados">
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          A Sementeira é um projeto que ajuda pessoas atingidas pelo rompimento da barragem em Brumadinho a elaborar propostas de projetos para o Anexo I.1.
          Para os fins da LGPD, quem hospeda o servidor da versão web é o controlador dos dados tratados nas duas exceções descritas acima (item 1). Dúvidas,
          pedidos de acesso, correção ou exclusão de dados podem ser enviados para{" "}
          <a href={`mailto:${CONTATO}`} className="text-[color:var(--sm-accent)] hover:underline">
            {CONTATO}
          </a>
          .
        </p>
      </Section>

      <Section title="3. Para que usamos os dados que chegam até nós">
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          O conteúdo dos seus projetos nunca chega até nós (ver item 4). O que efetivamente chega — os dados que você compartilha publicamente (item 6) e
          metadados técnicos de uso das rotas de IA (quando o log de auditoria do servidor está ativado, que registra só quem, provedor, modelo e tamanho da
          mensagem — nunca o conteúdo) — pode ser usado por quem hospeda a Sementeira para:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--sm-text-dim)]">
          <li>Melhorar os projetos e o funcionamento do app;</li>
          <li>Buscar parcerias e apoio institucional para o programa;</li>
          <li>Propor medidas e ajustes ao processo de reparação junto à Governança Popular e à Entidade Gestora;</li>
          <li>Avaliar como o app está sendo usado, para priorizar o que melhorar.</li>
        </ul>
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Esse uso é sempre agregado/estatístico, ou baseado em dados que você mesmo tornou públicos ao compartilhar — nunca envolve ler o conteúdo privado
          de um projeto que ficou só no seu navegador.
        </p>
      </Section>

      <Section title="4. Dados que ficam só no seu navegador (a maior parte do app)">
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Projetos, orçamentos, riscos, equipe, biblioteca pessoal, voluntários cadastrados e o histórico de versões lapidadas ficam salvos com a tecnologia{" "}
          <em>localStorage</em> do seu navegador, no seu computador. Nós (quem mantém o app) nunca recebemos, vemos nem guardamos esse conteúdo. Limpar os
          dados do navegador apaga tudo — por isso o app recomenda guardar uma cópia (exportar em PDF/DOCX/XLSX) do que for importante.
        </p>
      </Section>

      <Section title="5. Dados enviados à IA, quando você configura e usa esse recurso">
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Se você configurar um provedor de IA (DeepSeek, Maritaca ou Ollama local) nas Configurações, o texto do projeto que você está editando é enviado
          para esse provedor no momento em que você pede uma resposta — para gerar rascunhos, conversar com o Copiloto, rodar a Lapidação ou a Revisão
          independente. Isso só acontece quando você usa esses recursos, nunca em segundo plano. Provedores externos (DeepSeek, Maritaca) têm suas próprias
          políticas de privacidade, que valem para o tratamento que eles fazem desses dados. Quando o provedor é o "Servidor da Sementeira", o texto passa
          pelo nosso servidor só como um encaminhamento (proxy) até o provedor de IA escolhido por quem hospeda — não fica salvo.
        </p>
      </Section>

      <Section title='6. Dados que você opta por compartilhar publicamente ("comunidade")'>
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          As telas de Meus Projetos, Voluntários e Clube de Benefícios têm um botão "compartilhar", separado dos cadastros normais (que ficam só no seu
          navegador). Ao clicar nele, você vê um aviso explicando que aquele item vai ficar público — visível a qualquer pessoa que abrir o app, sem login —
          e só depois de confirmar o dado é enviado ao servidor e salvo.
        </p>
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Para projetos, só compartilhamos um <strong className="text-[color:var(--sm-text)]">resumo</strong>: título, ideia, dano, tipo de projeto, local e
          orçamento total. Dados de contato do projeto (coordenador, telefone, endereço, e-mail) <strong className="text-[color:var(--sm-text)]">nunca</strong>{" "}
          são incluídos nesse envio. Para voluntários e ofertas do Clube, os campos preenchidos no cadastro (nome, telefone, habilidades, descrição da
          oferta) ficam públicos até serem removidos.
        </p>
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          <strong className="text-[color:var(--sm-text)]">Prazo de guarda:</strong> os dados compartilhados publicamente (projetos, voluntários e ofertas do
          Clube) ficam guardados no servidor por até <strong className="text-[color:var(--sm-text)]">5 (cinco) anos</strong> a partir da data de publicação,
          ou até você pedir a remoção antes disso — o que ocorrer primeiro.
        </p>
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Como não existe login, a exclusão funciona por um código de edição gerado no momento em que você publica e guardado só no seu navegador — é o que
          permite remover depois. Se você perder esse código (por exemplo, limpando os dados do navegador), pode pedir a remoção pelo contato do item 2.
          Todo envio passa por um filtro automático contra conteúdo impróprio antes de ser aceito, e por moderação de quem administra o servidor depois.
        </p>
      </Section>

      <Section title="7. Biblioteca compartilhada (documentos públicos)">
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          A Biblioteca mostra uma lista de documentos oficiais (Proposta Definitiva, Ofícios) baixados automaticamente do site público da Entidade Gestora do
          Anexo I.1. Isso não envolve nenhum dado pessoal seu — é conteúdo público que o app reproduz para consulta.
        </p>
      </Section>

      <Section title="8. Hospedagem e infraestrutura">
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          O acesso ao site passa pela rede da Cloudflare, que atua como intermediária técnica (CDN/proteção contra abuso) e pode registrar metadados de
          conexão (como endereço IP) conforme a própria política de privacidade da Cloudflare. O servidor da Sementeira usa o endereço IP de quem acessa
          apenas para limitar automaticamente o número de pedidos por minuto/dia às rotas de IA e de compartilhamento comunitário (proteção contra abuso) —
          esse controle fica em memória, temporariamente, e não é salvo em arquivo por padrão. O app não usa cookies de rastreamento nem ferramentas de
          analytics de terceiros.
        </p>
      </Section>

      <Section title="9. Seus direitos como titular dos dados (LGPD, art. 18)">
        <p className="text-sm text-[color:var(--sm-text-dim)]">Em relação aos dados descritos nos itens 3, 5 e 6 (os únicos que chegam até nós), você pode pedir, pelo contato do item 2:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--sm-text-dim)]">
          <li>Confirmação de que tratamos algum dado seu, e acesso a ele;</li>
          <li>Correção de dado incompleto, inexato ou desatualizado;</li>
          <li>Exclusão de um item que você compartilhou publicamente (item 6), caso tenha perdido o código de edição;</li>
          <li>Informação sobre com quem compartilhamos o dado (no caso da IA, o provedor escolhido por você — ver item 5);</li>
          <li>Revogação do consentimento — não usar mais um recurso não afeta o restante do app, que já funciona localmente por padrão.</li>
        </ul>
      </Section>

      <Section title="10. Menores de idade">
        <p className="text-sm text-[color:var(--sm-text-dim)]">A Sementeira não é direcionada a crianças e não pede nem deveria receber dados de menores de 18 anos sem consentimento de um responsável.</p>
      </Section>

      <Section title="11. Mudanças nesta política">
        <p className="text-sm text-[color:var(--sm-text-dim)]">
          Se esta política mudar de forma relevante, a data no topo desta página será atualizada. Recomendamos revisitá-la de vez em quando.
        </p>
      </Section>
    </div>
  );
}
