import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../utils/logger';

/**
 * Envio de e-mail.
 *
 * Sem `SMTP_HOST` o e-mail é registrado no log em vez de enviado — dá para
 * desenvolver e rodar os testes sem caixa de saída, e o link de redefinir senha
 * aparece no terminal. Em produção, faltar SMTP é um defeito: o aviso sai como
 * `error`, não como `info`.
 *
 * Nada aqui joga exceção para cima. Um SMTP fora do ar não pode derrubar o
 * agendamento que a cliente acabou de fazer — o e-mail é consequência, não a
 * operação.
 */

export interface MailInput {
  to: string;
  subject: string;
  /** Corpo em texto. O HTML é montado em volta dele. */
  text: string;
  /** Botão de ação, quando houver. */
  action?: { label: string; url: string };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Um layout só para todos os e-mails: tabela centrada com largura fixa, que é
 * o que sobrevive ao Outlook e ao Gmail sem media query.
 */
function render(input: MailInput): string {
  const paragraphs = input.text
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(block)}</p>`)
    .join('');

  const button = input.action
    ? `<p style="margin:28px 0 8px">
         <a href="${escapeHtml(input.action.url)}"
            style="background:#d24362;color:#fff;text-decoration:none;border-radius:8px;
                   padding:12px 22px;display:inline-block;font-weight:600">
           ${escapeHtml(input.action.label)}
         </a>
       </p>
       <p style="margin:0;font-size:12px;color:#64748B;word-break:break-all">
         Se o botão não abrir, copie este endereço: ${escapeHtml(input.action.url)}
       </p>`
    : '';

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#F8FAFC;padding:32px 16px;
  font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#fff;border-radius:14px;padding:32px">
        <tr><td>
          <!-- A maioria dos programas de e-mail não baixa imagem sem a pessoa
               mandar. O texto alternativo é o que ela lê nesse caso, e vai
               estilizado para continuar parecendo o cabeçalho da marca em vez
               de um defeito. -->
          <img src="${escapeHtml(env.APP_URL)}/logo-clinistudio.png"
               alt="CliniStudio" width="194" height="48"
               style="display:block;border:0;margin:0 0 24px;height:48px;width:auto;
                      font-weight:700;font-size:18px;color:#d24362" />
          ${paragraphs}
          ${button}
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#94A3B8">
        Você recebeu este e-mail porque tem uma conta no CliniStudio.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

export const mailer = {
  isEnabled(): boolean {
    return env.mailEnabled;
  },

  async send(input: MailInput): Promise<boolean> {
    const transport = getTransporter();

    if (!transport) {
      // Em desenvolvimento isto é o esperado, e o link do corpo é o que a
      // pessoa precisa. Em produção é falha de configuração.
      const write = env.isProduction ? logger.error.bind(logger) : logger.info.bind(logger);
      write(
        {
          to: input.to,
          subject: input.subject,
          /*
           * O link fica de fora em produção — e ele é justamente o que dá
           * acesso.
           *
           * `action.url` carrega o token de redefinir senha. Escrito aqui, ele
           * vai para o log da hospedagem: lido por quem tem o projeto, guardado
           * por semanas, e válido por uma hora. Quem abrisse o log trocaria a
           * senha de qualquer conta sem precisar da caixa de e-mail de
           * ninguém.
           *
           * Em desenvolvimento o link continua, porque não há caixa de e-mail e
           * é assim que se testa o fluxo.
           */
          action: env.isProduction ? undefined : input.action?.url,
        },
        env.isProduction
          ? 'E-MAIL NÃO ENVIADO: SMTP_HOST não configurado'
          : 'E-mail (SMTP desligado — conteúdo no log)',
      );
      return false;
    }

    try {
      await transport.sendMail({
        from: env.MAIL_FROM,
        to: input.to,
        subject: input.subject,
        text: input.action ? `${input.text}\n\n${input.action.url}` : input.text,
        html: render(input),
      });
      logger.info({ to: input.to, subject: input.subject }, 'E-mail enviado');
      return true;
    } catch (error) {
      logger.error({ error, to: input.to, subject: input.subject }, 'Falha ao enviar e-mail');
      return false;
    }
  },
};
