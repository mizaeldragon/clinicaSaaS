/**
 * O aviso sonoro de agendamento novo.
 *
 * O som é sintetizado na hora, com dois osciladores, em vez de vir de um
 * arquivo. Não é preciosismo: um MP3 seria mais um download para uma recepção
 * com internet ruim, e um arquivo que não chegou é um aviso que não toca —
 * justamente quando a pessoa está de costas para a tela, que é a única
 * situação em que este recurso importa.
 *
 * O navegador proíbe tocar áudio antes de a pessoa interagir com a página.
 * É uma proteção contra sites que gritam sozinhos, e não há como burlar: o
 * contexto de áudio nasce suspenso e só um gesto de verdade o libera. Por isso
 * `ouvirPrimeiroGesto()` fica de tocaia no primeiro clique ou tecla, e ligar o
 * aviso nas configurações toca uma amostra — o clique que liga já é o gesto que
 * libera, e a pessoa confirma com o ouvido que funcionou.
 */

const CHAVE = 'clinistudio.aviso-sonoro';

let contexto: AudioContext | null = null;

type ConstrutorDeAudio = typeof AudioContext;

function obterContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const Construtor: ConstrutorDeAudio | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: ConstrutorDeAudio }).webkitAudioContext;

  if (!Construtor) return null;
  contexto ??= new Construtor();
  return contexto;
}

/**
 * Preferência de quem está usando, guardada só neste navegador.
 *
 * Fica ligada por padrão: quem não quer desliga no cabeçalho, mas quem precisa
 * do aviso e não sabe que ele existe nunca iria procurá-lo.
 */
export function avisoLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== 'off';
  } catch {
    // Janela anônima ou cookies bloqueados: o padrão vale.
    return true;
  }
}

export function definirAviso(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE, ligado ? 'on' : 'off');
  } catch {
    // Sem onde guardar, vale para esta sessão e pronto.
  }
}

/** Uma nota com ataque e queda suaves — sem isso o alto-falante estala. */
function nota(ac: AudioContext, hertz: number, atraso: number, duracao: number, volume: number) {
  const oscilador = ac.createOscillator();
  const ganho = ac.createGain();

  oscilador.type = 'sine';
  oscilador.frequency.value = hertz;

  const inicio = ac.currentTime + atraso;
  ganho.gain.setValueAtTime(0, inicio);
  ganho.gain.linearRampToValueAtTime(volume, inicio + 0.015);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);

  oscilador.connect(ganho).connect(ac.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracao + 0.02);
}

/**
 * Toca o aviso. Devolve false quando o navegador não deixou.
 *
 * Duas notas subindo (lá e mi), curtas. Sobe porque aviso que desce soa como
 * erro, e num salão o que chegou é uma cliente nova.
 */
export async function tocarAviso(): Promise<boolean> {
  const ac = obterContexto();
  if (!ac) return false;

  if (ac.state === 'suspended') {
    try {
      await ac.resume();
    } catch {
      return false;
    }
  }
  if (ac.state !== 'running') return false;

  nota(ac, 880, 0, 0.18, 0.18);
  nota(ac, 1318.5, 0.13, 0.28, 0.15);
  return true;
}

/**
 * Libera o áudio no primeiro gesto da pessoa, uma vez só.
 *
 * Sem isto, um agendamento que chega numa aba aberta há horas, sem ninguém ter
 * clicado em nada, seria engolido em silêncio.
 */
export function ouvirPrimeiroGesto(): () => void {
  const liberar = () => {
    obterContexto()?.resume().catch(() => undefined);
  };

  const eventos = ['pointerdown', 'keydown'] as const;
  for (const evento of eventos) {
    window.addEventListener(evento, liberar, { once: true, passive: true });
  }

  return () => {
    for (const evento of eventos) window.removeEventListener(evento, liberar);
  };
}
