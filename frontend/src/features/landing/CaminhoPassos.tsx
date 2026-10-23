import { useEffect, useRef } from 'react';

interface Props {
  passos: string[][];
}

/** Onde a ponta da linha fica na tela: pouco abaixo do meio, onde o olho já está. */
const PONTA_NA_TELA = 0.62;

/** Quanto do que falta a linha anda por quadro. Menor = mais lenta e macia. */
const SUAVIDADE = 0.045;

/**
 * Os passos ligados por um caminho que se desenha conforme a página rola.
 *
 * A curva é calculada a partir de onde os círculos estão de fato na tela, e não
 * de alturas fixas: um texto que quebra em mais linhas, a fonte que chega
 * depois ou o celular que empilha tudo numa coluna mudam as posições, e a
 * linha continua passando pelo meio de cada círculo.
 *
 * Tudo acontece mexendo no DOM direto, sem estado do React: o scroll dispara
 * dezenas de vezes por segundo, e redesenhar a seção inteira a cada evento
 * seria pagar caro por um traço.
 *
 * Sem JavaScript, ou com "reduzir movimento" ligado no sistema, o caminho já
 * aparece inteiro e os passos todos à vista.
 */
export function CaminhoPassos({ passos }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const trilho = useRef<SVGPathElement>(null);
  const traco = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = raiz.current;
    const fundo = trilho.current;
    const linha = traco.current;
    if (!el || !fundo || !linha) return;

    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nos = Array.from(el.querySelectorAll<HTMLElement>('.lp-caminho-no'));
    const itens = Array.from(el.querySelectorAll<HTMLElement>('.lp-caminho-passo'));

    let centros: { x: number; y: number }[] = [];
    let amostras: { y: number; len: number }[] = [];
    let total = 0;
    let quadro = 0;

    function desenhar() {
      const caixa = el!.getBoundingClientRect();
      centros = nos.map((no) => {
        const r = no.getBoundingClientRect();
        return { x: r.left - caixa.left + r.width / 2, y: r.top - caixa.top + r.height / 2 };
      });
      if (!centros.length) return;

      // Começa e termina um pouco fora dos círculos, no meio do caminho entre
      // as duas colunas — a linha chega de cima e segue para baixo, em vez de
      // nascer e morrer dentro de um círculo.
      const meio = centros.length > 1 ? (centros[0].x + centros[1].x) / 2 : centros[0].x;
      const folga = Math.min(110, el!.clientHeight * 0.12);
      const pontos = [
        { x: meio, y: centros[0].y - folga },
        ...centros,
        { x: meio, y: centros[centros.length - 1].y + folga },
      ];

      let d = `M ${pontos[0].x} ${pontos[0].y}`;
      for (let i = 1; i < pontos.length; i += 1) {
        const a = pontos[i - 1];
        const b = pontos[i];
        const curva = (b.y - a.y) * 0.5;
        d += ` C ${a.x} ${a.y + curva}, ${b.x} ${b.y - curva}, ${b.x} ${b.y}`;
      }
      fundo!.setAttribute('d', d);
      linha!.setAttribute('d', d);

      total = linha!.getTotalLength();
      linha!.style.strokeDasharray = `${total}`;

      // A curva só desce, então dá para saber "até onde desenhar" pela altura:
      // uma tabela de altura → comprimento evita perguntar ao SVG no scroll.
      amostras = [];
      const passosAmostra = 160;
      for (let i = 0; i <= passosAmostra; i += 1) {
        const len = (total * i) / passosAmostra;
        amostras.push({ y: linha!.getPointAtLength(len).y, len });
      }

      atualizar();
    }

    function comprimentoAte(y: number) {
      if (!amostras.length) return 0;
      if (y <= amostras[0].y) return 0;
      if (y >= amostras[amostras.length - 1].y) return total;
      let baixo = 0;
      let alto = amostras.length - 1;
      while (alto - baixo > 1) {
        const meio = (baixo + alto) >> 1;
        if (amostras[meio].y < y) baixo = meio;
        else alto = meio;
      }
      const a = amostras[baixo];
      const b = amostras[alto];
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.len + (b.len - a.len) * t;
    }

    /*
     * A linha não pula para onde a rolagem mandou: ela persegue esse ponto,
     * andando a cada quadro uma fração do que falta. Assim o traço desacelera
     * ao chegar, em vez de grudar no dedo — e quem rola de uma vez vê a linha
     * escorrer até lá.
     *
     * Círculos e textos reagem ao traço desenhado, não à rolagem: acendem
     * quando a linha de fato encosta neles.
     */
    let desenhado = 0;

    function atualizar() {
      quadro = 0;
      const ponta = parado
        ? Number.POSITIVE_INFINITY
        : window.innerHeight * PONTA_NA_TELA - el!.getBoundingClientRect().top;
      const alvo = comprimentoAte(ponta);

      const falta = alvo - desenhado;
      desenhado = parado || Math.abs(falta) < 0.5 ? alvo : desenhado + falta * SUAVIDADE;
      linha!.style.strokeDashoffset = `${total - desenhado}`;

      centros.forEach((centro, i) => {
        const chegada = comprimentoAte(centro.y);
        // O círculo acende quando a linha chega nele, e apaga se ela voltar.
        nos[i].classList.toggle('is-aceso', desenhado >= chegada - 2);
        // O texto aparece um pouco antes e fica: sumir com o que já foi lido,
        // só porque a pessoa subiu a página, seria tirar o chão dela.
        if (desenhado >= chegada - 90) itens[i].classList.add('is-visivel');
      });

      if (desenhado !== alvo) pedirQuadro();
    }

    function pedirQuadro() {
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    }

    el.classList.toggle('is-animado', !parado);
    desenhar();

    const observador = new ResizeObserver(desenhar);
    observador.observe(el);
    window.addEventListener('scroll', pedirQuadro, { passive: true });
    window.addEventListener('resize', pedirQuadro);

    return () => {
      observador.disconnect();
      window.removeEventListener('scroll', pedirQuadro);
      window.removeEventListener('resize', pedirQuadro);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [passos]);

  return (
    <div className="lp-caminho" ref={raiz}>
      <svg className="lp-caminho-svg" aria-hidden>
        <path ref={trilho} className="lp-caminho-trilho" />
        <path ref={traco} className="lp-caminho-traco" />
      </svg>

      <ol className="lp-caminho-lista">
        {passos.map(([titulo, texto], i) => (
          <li className={`lp-caminho-passo ${i % 2 ? 'direita' : 'esquerda'}`} key={titulo}>
            <span className="lp-caminho-no" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="lp-caminho-texto">
              <h3 className="lp-h3">{titulo}</h3>
              <p>{texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
