import { cn } from '@/lib/utils';

/**
 * A marca do produto, num lugar só.
 *
 * Antes cada tela desenhava a sua: um ícone genérico dentro de um quadradinho
 * colorido, mais o nome escrito ao lado. Eram quatro cópias que precisavam ser
 * lembradas juntas a cada mudança — e não eram a marca de verdade, só um
 * substituto.
 *
 * Duas formas, porque o logotipo tem duas:
 *
 * - `BrandLogo` — o logotipo horizontal (símbolo + nome). Vai onde há largura
 *   sobrando e o nome precisa ser lido: topo da landing, telas de entrada.
 * - `BrandMark` — só o símbolo. Vai onde o espaço é estreito ou o nome já está
 *   escrito ali do lado, como no menu lateral.
 *
 * O `width`/`height` nas imagens não é decoração: sem eles o navegador não sabe
 * quanto espaço reservar e o cabeçalho pula quando a imagem termina de carregar.
 */

interface BrandProps {
  className?: string;
}

export function BrandLogo({ className }: BrandProps) {
  return (
    <img
      src="/logo-clinistudio.png"
      alt="CliniStudio"
      width={776}
      height={192}
      className={cn('h-8 w-auto select-none', className)}
      draggable={false}
    />
  );
}

export function BrandMark({ className }: BrandProps) {
  return (
    <img
      src="/logo-marca.png"
      alt="CliniStudio"
      width={256}
      height={256}
      className={cn('size-8 select-none', className)}
      draggable={false}
    />
  );
}

/**
 * O símbolo sobre fundo dark.
 *
 * O símbolo é azul-marinho e vinho — as duas cores somem contra o menu lateral,
 * que é quase preto. A pastilha branca devolve o contraste sem repintar a marca,
 * que é o que uma identidade visual não deixa fazer.
 */
export function BrandMarkTile({ className }: BrandProps) {
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm',
        className,
      )}
    >
      <BrandMark className="size-[26px]" />
    </span>
  );
}
