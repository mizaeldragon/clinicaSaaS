/**
 * Endereço a partir do CEP, pelo ViaCEP.
 *
 * A consulta sai direto do navegador, sem passar pela API: o ViaCEP é público,
 * aceita chamada de outra origem e não pede chave. Passar pelo backend só
 * somaria uma ida a mais e um lugar a mais para cair.
 */

export interface EnderecoDoCep {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export type ResultadoCep =
  | { ok: true; endereco: EnderecoDoCep }
  | { ok: false; motivo: 'nao-encontrado' | 'indisponivel' };

/**
 * Oito segundos e desiste.
 *
 * Quem está preenchendo o cadastro não pode ficar com um campo girando para
 * sempre porque um serviço de terceiro está lento — melhor avisar e deixar
 * digitar à mão.
 */
const LIMITE_MS = 8_000;

export async function buscarCep(cep: string): Promise<ResultadoCep> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8) return { ok: false, motivo: 'nao-encontrado' };

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), LIMITE_MS);

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: controle.signal,
    });
    if (!resposta.ok) return { ok: false, motivo: 'indisponivel' };

    const dados = (await resposta.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };

    // CEP bem formado mas inexistente: o ViaCEP responde 200 com `erro`.
    if (dados.erro) return { ok: false, motivo: 'nao-encontrado' };

    return {
      ok: true,
      endereco: {
        rua: dados.logradouro ?? '',
        bairro: dados.bairro ?? '',
        cidade: dados.localidade ?? '',
        uf: dados.uf ?? '',
      },
    };
  } catch {
    return { ok: false, motivo: 'indisponivel' };
  } finally {
    clearTimeout(relogio);
  }
}
