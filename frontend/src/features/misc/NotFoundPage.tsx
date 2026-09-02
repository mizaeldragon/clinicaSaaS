import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="size-8" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="max-w-md text-muted-foreground">
          O endereço que você tentou acessar não existe ou o módulo correspondente não está
          habilitado para a sua empresa.
        </p>
      </div>
      <Button asChild size="lg">
        <Link to="/app">Voltar para o início</Link>
      </Button>
    </div>
  );
}
