import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './input';
import { phoneTyping } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Campos de entrada que precisam de comportamento, não só de aparência.
 *
 * Estavam repetidos: o olho da senha existia escrito à mão na tela de login, e
 * telefone era campo de texto cru em oito lugares — cada pessoa digitava de um
 * jeito e o banco guardava oito formatos diferentes do mesmo número.
 */

interface ControlledProps extends Omit<InputProps, 'onChange' | 'value' | 'type'> {
  value: string;
  /** Recebe o valor já formatado, que é o que vai para o banco. */
  onChange: (value: string) => void;
}

/**
 * Telefone com máscara.
 *
 * Guarda o valor formatado, e não só os dígitos, porque é assim que o resto do
 * sistema já grava — mudar isso agora deixaria os cadastros antigos num formato
 * e os novos noutro.
 *
 * `inputMode="numeric"` abre o teclado de números no celular, que é onde a
 * recepção mais cadastra cliente.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, ControlledProps>(
  ({ value, onChange, ...props }, ref) => (
    <Input
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      placeholder="(11) 99999-0000"
      maxLength={15}
      value={phoneTyping(value ?? '')}
      onChange={(event) => onChange(phoneTyping(event.target.value))}
      {...props}
    />
  ),
);
PhoneInput.displayName = 'PhoneInput';

/**
 * Senha com o olho para revelar.
 *
 * Existe porque senha digitada às cegas é senha digitada errado — e num
 * cadastro o erro só aparece quando a pessoa tenta entrar, muito depois, sem
 * saber o que aconteceu.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [visivel, setVisivel] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visivel ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          // Fora da ordem do Tab: quem está preenchendo o formulário com o
          // teclado quer ir para o próximo campo, não parar no olho.
          tabIndex={-1}
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
