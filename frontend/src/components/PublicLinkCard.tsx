import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PublicLinkCardProps {
  /** Slug da empresa. */
  companySlug: string;
  /** Slug da profissional — quando ausente, é o link do espaço inteiro. */
  professionalSlug?: string | null;
  title?: string;
  description?: string;
}

/** Endereço completo do link público, pronto para colar no Instagram. */
export function publicBookingUrl(companySlug: string, professionalSlug?: string | null): string {
  const path = professionalSlug ? `/e/${companySlug}/${professionalSlug}` : `/e/${companySlug}`;
  return `${window.location.origin}${path}`;
}

/**
 * O link que a profissional divulga para as próprias clientes. A dona do espaço
 * tem o dela e cada locatária tem o seu — quem abre já cai na agenda de quem
 * divulgou.
 */
export function PublicLinkCard({
  companySlug,
  professionalSlug,
  title = 'Seu link de agendamento',
  description = 'Divulgue no Instagram ou no WhatsApp — quem abrir marca direto com você.',
}: PublicLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const url = publicBookingUrl(companySlug, professionalSlug);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bloqueado (http, permissão): o link segue visível para copiar à mão.
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Link2 className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">{title}</h2>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">{description}</p>

      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-2 text-xs">
          {url}
        </code>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink />
            Abrir
          </a>
        </Button>
      </div>
    </Card>
  );
}
