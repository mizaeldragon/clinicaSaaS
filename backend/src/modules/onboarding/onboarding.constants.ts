/**
 * Catálogo usado no onboarding: cada opção marcada pela empresa vira uma
 * categoria e um conjunto de serviços já pré-cadastrados (editáveis depois).
 */
export interface OnboardingServiceSeed {
  key: string;
  label: string;
  category: string;
  categoryColor: string;
  services: { name: string; price: number; durationMinutes: number }[];
}

export const ONBOARDING_SERVICE_CATALOG: OnboardingServiceSeed[] = [
  {
    key: 'manicure',
    label: 'Manicure',
    category: 'Unhas',
    categoryColor: '#EC4899',
    services: [{ name: 'Manicure', price: 45, durationMinutes: 45 }],
  },
  {
    key: 'pedicure',
    label: 'Pedicure',
    category: 'Unhas',
    categoryColor: '#EC4899',
    services: [{ name: 'Pedicure', price: 55, durationMinutes: 60 }],
  },
  {
    key: 'nail_extension',
    label: 'Alongamento de unhas',
    category: 'Unhas',
    categoryColor: '#EC4899',
    services: [
      { name: 'Alongamento de unhas', price: 180, durationMinutes: 150 },
      { name: 'Manutenção de alongamento', price: 120, durationMinutes: 90 },
    ],
  },
  {
    key: 'hair',
    label: 'Cabelo',
    category: 'Cabelo',
    categoryColor: '#8B5CF6',
    services: [{ name: 'Atendimento capilar', price: 90, durationMinutes: 60 }],
  },
  {
    key: 'wash',
    label: 'Lavagem',
    category: 'Cabelo',
    categoryColor: '#8B5CF6',
    services: [{ name: 'Lavagem', price: 30, durationMinutes: 30 }],
  },
  {
    key: 'cut',
    label: 'Corte',
    category: 'Cabelo',
    categoryColor: '#8B5CF6',
    services: [{ name: 'Corte', price: 70, durationMinutes: 45 }],
  },
  {
    key: 'blowdry',
    label: 'Escova',
    category: 'Cabelo',
    categoryColor: '#8B5CF6',
    services: [{ name: 'Escova', price: 60, durationMinutes: 45 }],
  },
  {
    key: 'coloring',
    label: 'Coloração',
    category: 'Cabelo',
    categoryColor: '#8B5CF6',
    services: [{ name: 'Coloração', price: 250, durationMinutes: 150 }],
  },
  {
    key: 'hair_treatment',
    label: 'Tratamentos capilares',
    category: 'Cabelo',
    categoryColor: '#8B5CF6',
    services: [
      { name: 'Hidratação', price: 90, durationMinutes: 60 },
      { name: 'Progressiva', price: 320, durationMinutes: 180 },
    ],
  },
  {
    key: 'brows',
    label: 'Sobrancelhas',
    category: 'Sobrancelhas',
    categoryColor: '#F59E0B',
    services: [
      { name: 'Design de sobrancelha', price: 45, durationMinutes: 30 },
      { name: 'Design com henna', price: 65, durationMinutes: 45 },
      { name: 'Brow lamination', price: 150, durationMinutes: 60 },
    ],
  },
  {
    key: 'waxing',
    label: 'Depilação',
    category: 'Depilação',
    categoryColor: '#14B8A6',
    services: [
      { name: 'Depilação axila', price: 35, durationMinutes: 20 },
      { name: 'Depilação pernas', price: 90, durationMinutes: 45 },
      { name: 'Depilação virilha', price: 80, durationMinutes: 40 },
      { name: 'Depilação corpo inteiro', price: 220, durationMinutes: 120 },
    ],
  },
  {
    key: 'facial',
    label: 'Estética facial',
    category: 'Estética',
    categoryColor: '#0EA5E9',
    services: [
      { name: 'Limpeza de pele', price: 180, durationMinutes: 90 },
      { name: 'Peeling facial', price: 220, durationMinutes: 60 },
    ],
  },
  {
    key: 'body',
    label: 'Estética corporal',
    category: 'Estética',
    categoryColor: '#0EA5E9',
    services: [
      { name: 'Massagem modeladora', price: 160, durationMinutes: 60 },
      { name: 'Drenagem linfática', price: 150, durationMinutes: 60 },
    ],
  },
  {
    key: 'specialized',
    label: 'Procedimentos especializados',
    category: 'Procedimentos',
    categoryColor: '#EF4444',
    services: [{ name: 'Procedimento especializado', price: 400, durationMinutes: 90 }],
  },
  {
    key: 'others',
    label: 'Outros',
    category: 'Outros',
    categoryColor: '#64748B',
    services: [{ name: 'Serviço avulso', price: 100, durationMinutes: 60 }],
  },
];

export const ONBOARDING_SERVICE_KEYS = ONBOARDING_SERVICE_CATALOG.map((c) => c.key);

/** Tipos de recurso oferecidos na pergunta "sua empresa aluga espaços?". */
export const RENTAL_RESOURCE_TYPES = [
  { key: 'tables', label: 'Mesas', categoryName: 'Mesas', isRoom: false, samples: ['Mesa 01', 'Mesa 02'] },
  { key: 'chairs', label: 'Cadeiras', categoryName: 'Cadeiras', isRoom: false, samples: ['Cadeira 01', 'Cadeira 02'] },
  { key: 'rooms', label: 'Salas', categoryName: 'Salas', isRoom: true, samples: ['Sala 01', 'Sala 02'] },
  { key: 'others', label: 'Outros recursos', categoryName: 'Outros recursos', isRoom: false, samples: ['Recurso 01'] },
] as const;

export const RENTAL_RESOURCE_KEYS = RENTAL_RESOURCE_TYPES.map((t) => t.key);

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Aluguel',
  'Produtos',
  'Energia',
  'Água',
  'Salários',
  'Materiais',
  'Marketing',
  'Outros',
];
