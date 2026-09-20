/**
 * Dinheiro em JavaScript.
 *
 * Preço sai do banco como Decimal e vira `number` para as contas — e `number` é
 * ponto flutuante: `0.1 + 0.2` dá `0.30000000000000004`. Somando três serviços
 * de R$ 66,67, o total chega ao banco com uma sujeira de bilionésimos que
 * aparece depois num fechamento que "não bate por um centavo".
 *
 * Não é uma biblioteca de decimal — é a régua no lugar certo: arredondar para
 * centavos assim que a conta termina, antes de guardar ou comparar.
 */

/** Arredonda para centavos. R$ 12,345 vira R$ 12,35. */
export function emCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Soma valores em reais sem deixar resíduo de ponto flutuante. */
export function somar(valores: number[]): number {
  return emCentavos(valores.reduce((total, valor) => total + valor, 0));
}
