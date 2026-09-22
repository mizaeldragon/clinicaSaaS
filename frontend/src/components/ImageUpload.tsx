import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Envio de imagem com prévia.
 *
 * O arquivo sobe para a API e o que fica guardado no cadastro é o endereço
 * devolvido — a mesma coisa que antes só dava para colar à mão.
 */
export function ImageUpload({
  label,
  value,
  onChange,
  hint,
  rounded = 'xl',
  formato = 'quadrado',
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
  rounded?: 'xl' | 'full';
  /**
   * `capa` mostra a prévia larga, na proporção em que a imagem vai aparecer.
   *
   * No quadradinho de 80px a foto de capa ficava idêntica à da logo, e quem
   * chegava na tela não tinha como saber qual era qual — dois campos com a
   * mesma cara, um acima do outro. Larga, a prévia já diz o que é.
   */
  formato?: 'quadrado' | 'capa';
}) {
  const input = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);

  async function send(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error('A imagem precisa ter no máximo 4 MB');
      return;
    }

    const body = new FormData();
    body.append('file', file);

    setSending(true);
    try {
      const { url } = await api.upload<{ url: string }>('/uploads', body);
      onChange(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a imagem');
    } finally {
      setSending(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      <div className={cn('gap-4', formato === 'capa' ? 'space-y-3' : 'flex items-center')}>
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden border bg-muted/40 text-muted-foreground',
            formato === 'capa' ? 'aspect-[3/1] w-full rounded-xl' : 'size-20 shrink-0',
            formato === 'capa' ? '' : rounded === 'full' ? 'rounded-full' : 'rounded-xl',
          )}
        >
          {sending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : value ? (
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className={formato === 'capa' ? 'size-7' : 'size-5'} />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImagePlus />
            {value ? 'Trocar imagem' : 'Enviar imagem'}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 />
              Remover
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{hint ?? 'JPG, PNG ou WEBP, até 4 MB.'}</p>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void send(file);
        }}
      />
    </div>
  );
}
