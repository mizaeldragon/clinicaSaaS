/**
 * Filtra para onde é permitido mandar a pessoa depois do login.
 *
 * Quem tenta abrir uma tela sem estar logada é desviada para o login, e o
 * caminho original viaja junto para que ela caia onde queria ir. O problema é
 * que esse caminho nasce da barra de endereços: quem manda o link escolhe o
 * valor.
 *
 * Um endereço como `//site-do-golpe.com` — ou `/\site-do-golpe.com`, que o
 * navegador trata igual — tem a cara de caminho interno, mas o roteador o
 * entende como site externo. O ataque é mandar esse link para a dona do salão:
 * ela entra com a senha dela, no domínio certo, e é jogada num site que imita a
 * tela de "sessão expirada". Ela digita a senha de novo, agora para o invasor.
 *
 * Por isso só passa caminho que comece com **uma** barra e não seja seguido de
 * outra barra nem de contrabarra. Qualquer outra coisa vira o destino padrão.
 */
export function safeInternalPath(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  if (value[0] !== '/') return fallback;
  if (value[1] === '/' || value[1] === '\\') return fallback;
  // `\` em qualquer posição não aparece em rota nossa e é o que os navegadores
  // normalizam para `/` — fora daqui.
  if (value.includes('\\')) return fallback;
  return value;
}
