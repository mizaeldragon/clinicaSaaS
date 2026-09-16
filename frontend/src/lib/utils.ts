import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Converte "#7C3AED" nos três números de HSL. */
function hexToHsl(hex: string): Hsl | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;

  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Converte "#7C3AED" para o formato "262 83% 58%" usado nas CSS vars. */
export function hexToHslVar(hex: string): string | null {
  const hsl = hexToHsl(hex);
  return hsl && `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const saturacao = s / 100;
  const luz = l / 100;
  const c = (1 - Math.abs(2 * luz - 1)) * saturacao;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = luz - c / 2;

  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];

  return [r + m, g + m, b + m];
}

/**
 * Luminância relativa da WCAG 2.1.
 *
 * Não é a média dos canais: o olho enxerga o verde muito mais que o azul, e
 * por isso os pesos são tão desiguais. É o que faz um amarelo forte contar
 * como cor "clara" e um azul da mesma intensidade contar como escura.
 */
function luminancia(rgb: [number, number, number]): number {
  const linear = (canal: number) =>
    canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = rgb.map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: number, b: number): number {
  const [claro, escuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (escuro + 0.05);
}

const BRANCO = '0 0% 100%';
const TINTA = { h: 224, s: 30, l: 12 };
const TINTA_VAR = `${TINTA.h} ${TINTA.s}% ${TINTA.l}%`;

/** O mínimo da WCAG para texto normal. */
const CONTRASTE_MINIMO = 4.5;

/**
 * Escolhe entre texto claro e escuro para escrever em cima de uma cor.
 *
 * A cliente escolhe a cor do próprio espaço, e nada impede que escolha um rosa
 * quase branco. Com o texto fixo em branco, o botão "Salvar alterações" vira
 * uma mancha clara sem palavra legível dentro. Aqui a decisão passa a ser da
 * cor: mede-se o contraste contra branco e contra a tinta escura do tema, e
 * ganha o maior.
 */
export function foregroundParaFundo(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return BRANCO;

  const fundo = luminancia(hslToRgb(hsl));
  const comBranco = contraste(fundo, luminancia([1, 1, 1]));
  const comTinta = contraste(fundo, luminancia(hslToRgb(TINTA)));

  return comBranco >= comTinta ? BRANCO : TINTA_VAR;
}

/**
 * A mesma cor, escurecida só o quanto for preciso para ser lida sobre branco.
 *
 * Serve para quando a cor da empresa é o *texto*, e não o fundo — o item ativo
 * do menu, por exemplo. Um lilás claro funciona como pastilha e some como
 * letra; escurecer mantendo o tom preserva a identidade sem sacrificar a
 * leitura. Se nem preto chegar ao mínimo, para no fim da escala em vez de
 * entrar em laço infinito.
 */
export function tintaLegivel(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return TINTA_VAR;

  const branco = luminancia([1, 1, 1]);
  let l = hsl.l;

  while (l > 4 && contraste(luminancia(hslToRgb({ ...hsl, l })), branco) < CONTRASTE_MINIMO) {
    l -= 2;
  }

  return `${hsl.h} ${hsl.s}% ${l}%`;
}

const BRAND_VARS = ['--primary', '--ring', '--sidebar-accent'] as const;
const DERIVADAS = ['--primary-foreground', '--primary-ink'] as const;

export function applyBrandColor(hex?: string | null) {
  if (!hex) return;
  const hsl = hexToHslVar(hex);
  if (!hsl) return;

  for (const name of BRAND_VARS) {
    document.documentElement.style.setProperty(name, hsl);
  }
  document.documentElement.style.setProperty('--primary-foreground', foregroundParaFundo(hex));
  document.documentElement.style.setProperty('--primary-ink', tintaLegivel(hex));
}

/**
 * Devolve a marca do produto. A cor da empresa é aplicada no documento inteiro,
 * então sem isso ela ficaria grudada no login e na landing depois do logout.
 */
export function resetBrandColor() {
  for (const name of [...BRAND_VARS, ...DERIVADAS]) {
    document.documentElement.style.removeProperty(name);
  }
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
