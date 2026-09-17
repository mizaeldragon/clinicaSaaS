import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute, ModuleRoute, SuperAdminRoute } from '@/components/layout/guards';

import { AuthSwitch } from '@/features/auth/AuthSwitch';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AgendaPage } from '@/features/agenda/AgendaPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
import { ServicesPage } from '@/features/services/ServicesPage';
import { ProfessionalsPage } from '@/features/professionals/ProfessionalsPage';
import { ProfessionalDetailPage } from '@/features/professionals/ProfessionalDetailPage';
import { ResourcesPage } from '@/features/resources/ResourcesPage';
import { RentalsPage } from '@/features/rentals/RentalsPage';
import { MyShiftsPage } from '@/features/rentals/MyShiftsPage';
import { FinancialPage } from '@/features/financial/FinancialPage';
import { CommissionsPage } from '@/features/commissions/CommissionsPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AdminOverviewPage } from '@/features/admin/AdminOverviewPage';
import { AdminCompaniesPage } from '@/features/admin/AdminCompaniesPage';
import { AdminPlansPage } from '@/features/admin/AdminPlansPage';
import { NotFoundPage } from '@/features/misc/NotFoundPage';
import { PublicBookingPage } from '@/features/public/PublicBookingPage';
import { PublicAppointmentPage } from '@/features/public/PublicAppointmentPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { PrivacidadePage, TermosPage } from '@/features/landing/LegalPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Vitrine do produto. Quem já está logado cai direto no painel. */}
      <Route path="/" element={<LandingPage />} />
      {/* Uma tela só, com o interruptor entre Entrar e Criar conta. Os dois
          endereços continuam existindo para o botão voltar e para os links da
          landing; é o caminho que decide qual metade abre. */}
      <Route path="/login" element={<AuthSwitch />} />
      <Route path="/cadastro" element={<AuthSwitch />} />
      <Route path="/esqueci-a-senha" element={<ForgotPasswordPage />} />

      {/* Documentos do rodapé. Abertos, sem login: quem está decidindo se
          assina precisa ler antes de criar conta. */}
      <Route path="/termos" element={<TermosPage />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />
      {/* O endereço que vai no e-mail: /redefinir-senha?token=... */}
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      {/* Página pública de agendamento — sem login */}
      <Route path="/e/:slug" element={<PublicBookingPage />} />
      {/* O horário da própria cliente, pelo link que ela recebeu. */}
      <Route path="/e/:slug/agendamento/:token" element={<PublicAppointmentPage />} />
      {/* Link individual: cada profissional divulga o seu. */}
      <Route path="/e/:slug/:professionalSlug" element={<PublicBookingPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />

          <Route element={<ModuleRoute module="appointments" />}>
            <Route path="agenda" element={<AgendaPage />} />
          </Route>

          <Route element={<ModuleRoute module="customers" />}>
            <Route path="clientes" element={<CustomersPage />} />
            <Route path="clientes/:id" element={<CustomerDetailPage />} />
          </Route>

          <Route element={<ModuleRoute module="services" />}>
            <Route path="servicos" element={<ServicesPage />} />
          </Route>

          <Route element={<ModuleRoute module="professionals" />}>
            <Route path="profissionais" element={<ProfessionalsPage />} />
            <Route path="profissionais/:id" element={<ProfessionalDetailPage />} />
          </Route>

          <Route element={<ModuleRoute module="resources" />}>
            <Route path="recursos" element={<ResourcesPage />} />
          </Route>

          <Route element={<ModuleRoute module="rentals" />}>
            <Route path="alugueis" element={<RentalsPage />} />
            <Route path="meus-turnos" element={<MyShiftsPage />} />
          </Route>

          <Route element={<ModuleRoute module="financial" />}>
            <Route path="financeiro" element={<FinancialPage />} />
          </Route>

          <Route element={<ModuleRoute module="commissions" />}>
            <Route path="comissoes" element={<CommissionsPage />} />
          </Route>

          <Route element={<ModuleRoute module="reports" />}>
            <Route path="relatorios" element={<ReportsPage />} />
          </Route>

          <Route path="configuracoes" element={<SettingsPage />} />
        </Route>

        <Route element={<SuperAdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="empresas" element={<AdminCompaniesPage />} />
            <Route path="planos" element={<AdminPlansPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
