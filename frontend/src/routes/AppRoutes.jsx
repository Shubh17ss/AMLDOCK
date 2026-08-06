import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { LandingPage } from '../pages/LandingPage.jsx';
import { PricingPage } from '../pages/PricingPage.jsx';
import { ContactPage } from '../pages/ContactPage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { AdminLoginPage } from '../pages/AdminLoginPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { BranchUsersPage } from '../pages/BranchUsersPage.jsx';
import { FirmAdminDetailPage } from '../pages/admin/FirmAdminDetailPage.jsx';
import {
  DEAL_AUTHOR_ROLES, DEAL_REVIEWER_ROLES, SETTINGS_ROLES, SECTION_READ_ROLES,
  FINANCE_SECTION_ROLES,
  TRAINING_ASSIGNABLE_ROLES,
} from '../auth/roles.js';
import { HomeRedirect } from '../pages/HomeRedirect.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { CddRegisterPage } from '../pages/CddRegisterPage.jsx';
import { PlaceholderPage } from '../pages/PlaceholderPage.jsx';
import {
  placeholderRoutes, CDD_REGISTER_PATH, DEALS_PATH, CDD_SECTION_PATHS, INTL_FUND_TRANSACTIONS_PATH,
  SUSPICIOUS_ACTIVITIES_PATH, STAFF_TRAINING_PATH, MY_TRAINING_PATH, SECTION_LANDING_GROUPS,
  FINANCE_PATHS,
} from '../navigation/moduleRegistry.jsx';
import { DocumentModulePage, DOCUMENT_MODULES } from '../pages/documents/DocumentModulePage.jsx';
import { SectionLandingPage } from '../pages/SectionLandingPage.jsx';
import { InternationalFundTransactionRegisterPage } from '../pages/monitoring/InternationalFundTransactionRegisterPage.jsx';
import { SuspiciousActivityRegisterPage } from '../pages/monitoring/SuspiciousActivityRegisterPage.jsx';
import { StaffTrainingPage } from '../pages/training/StaffTrainingPage.jsx';
import { MyTrainingPage } from '../pages/training/MyTrainingPage.jsx';
import { UsersAdminPage } from '../pages/admin/UsersAdminPage.jsx';
import { FirmsAdminPage } from '../pages/admin/FirmsAdminPage.jsx';
import { AuditAdminPage } from '../pages/admin/AuditAdminPage.jsx';
import { MyDealsPage } from '../pages/MyDealsPage.jsx';
import { DealsPage } from '../pages/DealsPage.jsx';
import { FirmDealsPage } from '../pages/FirmDealsPage.jsx';
import { NewDealWizardPage } from '../pages/NewDealWizardPage.jsx';
import { DealDetailPage } from '../pages/DealDetailPage.jsx';
import { DealReviewScreen } from '../pages/DealReviewScreen.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

/**
 * Who may open a section landing or module route. Everything is section-read except the two
 * Monitoring modules FINANCE works in, plus the landing they sit under.
 */
const rolesFor = (path) =>
  (FINANCE_PATHS.includes(path) ? FINANCE_SECTION_ROLES : SECTION_READ_ROLES);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />

      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/app" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* CDD Register — the role-aware stats dashboard (the CDD group landing) */}
        <Route path={CDD_REGISTER_PATH} element={<CddRegisterPage />} />

        {/* Deals — the full deal list with filters (formerly the /queue compliance queue) */}
        <Route path={DEALS_PATH} element={<DealsPage />} />

        {/* Section landings — clicking a menu section header shows a card per module in it,
            each with its review status. The CDD landing is the stats dashboard instead, so
            it isn't in SECTION_LANDING_GROUPS. Only CDD is open to everyone. */}
        {SECTION_LANDING_GROUPS.map((g) => {
          const page = <SectionLandingPage group={g} />;
          return (
            <Route
              key={g.to}
              path={g.to}
              element={CDD_SECTION_PATHS.has(g.to)
                ? page
                : <ProtectedRoute roles={rolesFor(g.to)}>{page}</ProtectedRoute>}
            />
          );
        })}

        {/* Versioned compliance document registers (upload + history). Outside the CDD
            section, so restricted to the full-workspace roles. */}
        {DOCUMENT_MODULES.map((m) => (
          <Route
            key={m.path}
            path={m.path}
            element={
              <ProtectedRoute roles={SECTION_READ_ROLES}>
                <DocumentModulePage category={m.category} title={m.title} moduleKey={m.id} />
              </ProtectedRoute>
            }
          />
        ))}

        {/* Monitoring › International Fund Transaction Register. Outside the CDD section, so
            restricted to the full-workspace roles like the Documents registers. */}
        <Route path={INTL_FUND_TRANSACTIONS_PATH} element={
          <ProtectedRoute roles={FINANCE_SECTION_ROLES}>
            <InternationalFundTransactionRegisterPage />
          </ProtectedRoute>
        } />

        {/* Monitoring › Suspicious Activity Register — same gating as the register above. */}
        <Route path={SUSPICIOUS_ACTIVITIES_PATH} element={
          <ProtectedRoute roles={SECTION_READ_ROLES}>
            <SuspiciousActivityRegisterPage />
          </ProtectedRoute>
        } />

        {/* AML Training › Staff Training — the workspace for whoever runs training. */}
        <Route path={STAFF_TRAINING_PATH} element={
          <ProtectedRoute roles={SECTION_READ_ROLES}>
            <StaffTrainingPage />
          </ProtectedRoute>
        } />

        {/* My Training — the personal view, for everyone who can hold an assignment: branch
            staff plus the firm's compliance officers and senior managers. */}
        <Route path={MY_TRAINING_PATH} element={
          <ProtectedRoute roles={TRAINING_ASSIGNABLE_ROLES}>
            <MyTrainingPage />
          </ProtectedRoute>
        } />

        {/* Settings › Users — user admin. ROOT sees every firm; compliance officers and senior
            managers see the same screen, scoped by the API to their own reporting entity. */}
        <Route path="/settings/users" element={
          <ProtectedRoute roles={SETTINGS_ROLES}>
            <UsersAdminPage />
          </ProtectedRoute>
        } />

        {/* Settings › Reporting Entities — entity admin, same firm scoping as above. */}
        <Route path="/settings/reporting-entities" element={
          <ProtectedRoute roles={SETTINGS_ROLES}>
            <FirmsAdminPage />
          </ProtectedRoute>
        } />
        <Route path="/settings/reporting-entities/:id" element={
          <ProtectedRoute roles={SETTINGS_ROLES}>
            <FirmAdminDetailPage />
          </ProtectedRoute>
        } />

        {/* Compliance modules + group landings — placeholders until each is built out.
            Only the CDD section is open to everyone; other sections need the full-workspace roles. */}
        {placeholderRoutes().map((r) => {
          const page = <PlaceholderPage title={r.title} detail="Coming soon — this module will be built out." />;
          return (
            <Route
              key={r.to}
              path={r.to}
              element={CDD_SECTION_PATHS.has(r.to)
                ? page
                : <ProtectedRoute roles={rolesFor(r.to)}>{page}</ProtectedRoute>}
            />
          );
        })}

        <Route path="/my-deals" element={
          <ProtectedRoute roles={DEAL_AUTHOR_ROLES}>
            <MyDealsPage />
          </ProtectedRoute>
        } />
        <Route path="/deals/new" element={
          <ProtectedRoute roles={DEAL_AUTHOR_ROLES}>
            <NewDealWizardPage />
          </ProtectedRoute>
        } />
        <Route path="/deals/:id" element={<DealDetailPage />} />
        <Route path="/deals/:id/review" element={
          <ProtectedRoute roles={DEAL_REVIEWER_ROLES}>
            <DealReviewScreen />
          </ProtectedRoute>
        } />

        <Route path="/firm/deals" element={
          <ProtectedRoute roles={['SALES_MANAGER', ...DEAL_REVIEWER_ROLES, 'ROOT']}>
            <FirmDealsPage />
          </ProtectedRoute>
        } />
        <Route path="/firm/deals/:id" element={
          <ProtectedRoute roles={['SALES_MANAGER', ...DEAL_REVIEWER_ROLES, 'ROOT']}>
            <DealDetailPage />
          </ProtectedRoute>
        } />

        <Route path="/branch-users" element={
          <ProtectedRoute roles={['SALES_MANAGER']}>
            <BranchUsersPage />
          </ProtectedRoute>
        } />

        <Route path="/admin/audit" element={
          <ProtectedRoute roles={['ROOT']}>
            <AuditAdminPage />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
