import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/brand';
import './landing.css';

/**
 * Termos de uso e política de privacidade.
 *
 * Mesma moldura da vitrine, porque é de lá que se chega — trocar de identidade
 * no caminho faz a pessoa duvidar se ainda está no mesmo site, e estas são
 * justamente as páginas em que ela foi procurar confiança.
 *
 * O texto é um ponto de partida honesto sobre o que o sistema realmente faz,
 * não um contrato pronto. Quem assina embaixo é o advogado.
 */

interface Secao {
  titulo: string;
  paragrafos: string[];
  lista?: string[];
}

function Documento({
  titulo,
  atualizadoEm,
  resumo,
  secoes,
}: {
  titulo: string;
  atualizadoEm: string;
  resumo: string;
  secoes: Secao[];
}) {
  // Quem clica no rodapé chega no meio da rolagem da landing.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="lp">
      <div className="lp-topo lp-topo--solto">
        <div className="lp-wrap lp-pad lp-topo-linha">
          <Link to="/" className="lp-marca" aria-label="CliniStudio, início">
            <BrandLogo className="lp-logo" />
          </Link>
          <div className="lp-acoes">
            <Link to="/" className="lp-link lp-entrar">
              Voltar ao site
            </Link>
          </div>
        </div>
      </div>

      <div className="lp-wrap lp-pad lp-legal">
        <p className="lp-eyebrow">
          <i />
          <span>{atualizadoEm}</span>
        </p>

        <h1 className="lp-h2 lp-legal-titulo">{titulo}</h1>
        <p className="lp-legal-resumo">{resumo}</p>

        {secoes.map((secao, i) => (
          <section className="lp-legal-secao" key={secao.titulo}>
            <h2>
              <span className="lp-legal-num">{String(i + 1).padStart(2, '0')}</span>
              {secao.titulo}
            </h2>
            {secao.paragrafos.map((texto) => (
              <p key={texto}>{texto}</p>
            ))}
            {secao.lista ? (
              <ul>
                {secao.lista.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <p className="lp-legal-contato">
          Dúvidas sobre este documento? Escreva para{' '}
          <a href="mailto:contato@clinistudio.app">contato@clinistudio.app</a>.
        </p>
      </div>

      <div className="lp-rodape lp-rodape-simples">
        <div className="lp-wrap lp-pad lp-rodape-linha">
          <span className="lp-rodape-copy">
            © {new Date().getFullYear()} CliniStudio · Gestão para espaços de beleza
          </span>
          <div className="lp-rodape-links">
            <Link to="/termos">Termos</Link>
            <Link to="/privacidade">Privacidade</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TermosPage() {
  return (
    <Documento
      titulo="Termos de uso"
      atualizadoEm="Atualizado em setembro de 2026"
      resumo="As regras de uso do CliniStudio. Em linguagem direta, porque contrato que ninguém entende não protege ninguém."
      secoes={[
        {
          titulo: 'O que o CliniStudio é',
          paragrafos: [
            'O CliniStudio é um sistema de gestão para salões, clínicas de estética, barbearias e espaços de beleza compartilhados. Ele organiza agenda, clientes, serviços, caixa, comissões e o aluguel de espaços.',
            'Você assina um plano mensal e usa o sistema pelo navegador. Não há instalação, e o acesso vale de qualquer aparelho.',
          ],
        },
        {
          titulo: 'Sua conta',
          paragrafos: [
            'A conta é da empresa. Quem cria a conta é o responsável por ela e pode criar acessos para a equipe, cada um com a própria senha e com as permissões que você definir.',
            'Você é responsável por manter a sua senha em segredo e por tudo que acontecer com o seu acesso. Se desconfiar que alguém entrou na sua conta, troque a senha e avise a gente.',
          ],
        },
        {
          titulo: 'Pagamento e teste gratuito',
          paragrafos: [
            'Todo plano começa com 5 dias de teste gratuito, sem cartão de crédito. Terminado o teste, a assinatura passa a ser cobrada mensalmente no valor do plano escolhido.',
            'Se um pagamento atrasar, o acesso para lançar coisas novas é suspenso, mas seus dados continuam lá e voltam assim que o pagamento for regularizado.',
          ],
        },
        {
          titulo: 'Cancelamento',
          paragrafos: [
            'Você pode cancelar quando quiser, sem multa e sem carência. O acesso continua até o fim do período já pago.',
            'Antes de cancelar, exporte o que quiser guardar. Depois do cancelamento os dados ficam disponíveis por um tempo razoável para você recuperar, e então são apagados.',
          ],
        },
        {
          titulo: 'Seus dados são seus',
          paragrafos: [
            'Os cadastros de clientes, os atendimentos e os lançamentos financeiros que você registra pertencem a você. A gente hospeda e protege, mas não usa esses dados para outro fim nem vende para ninguém.',
            'Cada empresa enxerga apenas os próprios dados. Em espaços compartilhados, a agenda e o financeiro de cada profissional que aluga ficam separados dos da casa.',
          ],
        },
        {
          titulo: 'O que não é permitido',
          paragrafos: ['Usando o CliniStudio, você concorda em não:'],
          lista: [
            'usar o sistema para qualquer atividade ilegal',
            'tentar acessar dados de outra empresa',
            'sobrecarregar o sistema de propósito ou tentar burlar limites do plano',
            'revender o acesso como se fosse um produto seu',
          ],
        },
        {
          titulo: 'Disponibilidade',
          paragrafos: [
            'A gente trabalha para o sistema estar sempre no ar, mas nenhum serviço na internet é imune a falha, manutenção ou problema de terceiros. Quando houver parada programada, avisamos antes.',
            'Mantemos cópias de segurança dos dados. Ainda assim, vale manter o seu próprio controle do que for crítico para o seu negócio.',
          ],
        },
        {
          titulo: 'Mudanças nestes termos',
          paragrafos: [
            'Se estes termos mudarem de forma relevante, avisamos com antecedência pelo e-mail cadastrado. Continuar usando o sistema depois disso significa concordar com a nova versão.',
          ],
        },
      ]}
    />
  );
}

export function PrivacidadePage() {
  return (
    <Documento
      titulo="Política de privacidade"
      atualizadoEm="Atualizado em setembro de 2026"
      resumo="Que dados o CliniStudio guarda, por quê, e o que você pode pedir a qualquer momento."
      secoes={[
        {
          titulo: 'Dois tipos de dado',
          paragrafos: [
            'O primeiro é o da sua empresa: nome, CNPJ, contato e os dados de quem tem login. Precisamos deles para manter a conta e emitir a cobrança.',
            'O segundo é o que você registra no sistema — clientes, atendimentos, valores. Esses dados são seus. A gente é apenas quem guarda, e só os acessa quando você pede ajuda ou quando é indispensável para consertar uma falha.',
          ],
        },
        {
          titulo: 'Por que guardamos',
          paragrafos: ['Cada dado tem um motivo concreto de existir:'],
          lista: [
            'manter a sua conta funcionando e o sistema no ar',
            'emitir a mensalidade e cumprir obrigações fiscais',
            'avisar sobre agendamentos, cobranças e mudanças importantes',
            'investigar problema de segurança e sustentar o registro de auditoria',
          ],
        },
        {
          titulo: 'Com quem compartilhamos',
          paragrafos: [
            'Com o mínimo necessário para o sistema funcionar: quem hospeda os servidores, quem processa o pagamento da mensalidade e quem entrega os e-mails. Cada um recebe apenas o que precisa para fazer a sua parte.',
            'Não vendemos dados, não usamos para publicidade e não repassamos para terceiros com outro fim. Só entregamos algo a autoridade quando houver ordem legal.',
          ],
        },
        {
          titulo: 'Como protegemos',
          paragrafos: [
            'O tráfego trafega cifrado. As senhas são guardadas em hash e não podem ser lidas nem por nós. O segundo fator de autenticação, quando ligado, fica cifrado no banco.',
            'Cada empresa é isolada das outras na própria camada de acesso aos dados, não apenas na tela. Toda ação sensível fica registrada em auditoria.',
          ],
        },
        {
          titulo: 'Seus direitos (LGPD)',
          paragrafos: [
            'A Lei Geral de Proteção de Dados garante a você, e às suas clientes, alguns direitos. Para exercer qualquer um deles, escreva para o nosso contato.',
          ],
          lista: [
            'saber quais dados temos e de onde vieram',
            'corrigir dado incompleto ou errado',
            'pedir cópia dos seus dados em formato legível',
            'pedir a exclusão do que não formos obrigados a manter por lei',
            'revogar um consentimento que você tenha dado',
          ],
        },
        {
          titulo: 'As clientes do seu espaço',
          paragrafos: [
            'Quando você cadastra uma cliente, quem responde por aqueles dados perante a lei é a sua empresa — a gente entra como operador. Cabe a você avisar suas clientes sobre o uso dos dados e ter a permissão delas quando for o caso.',
            'Se uma cliente sua pedir para ser excluída, você faz isso direto no sistema; se precisar de ajuda, a gente ajuda.',
          ],
        },
        {
          titulo: 'Por quanto tempo',
          paragrafos: [
            'Enquanto a conta estiver ativa, mantemos tudo. Depois do cancelamento, os dados ficam disponíveis por um tempo razoável para você recuperar e então são apagados — exceto o que a lei obrigar a guardar, como registros fiscais.',
          ],
        },
        {
          titulo: 'Cookies',
          paragrafos: [
            'Usamos o mínimo: o necessário para manter você conectado e lembrar preferências suas, como o aviso sonoro ligado ou desligado. Não usamos cookie de publicidade nem de rastreamento entre sites.',
          ],
        },
      ]}
    />
  );
}
