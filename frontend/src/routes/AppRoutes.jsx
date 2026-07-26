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
  DEAL_AUTHOR_ROLES, DEAL_REVIEWER_ROLES, SETTINGS_ROLES, FULL_WORKSPACE_ROLES,
} from '../auth/roles.js';
import { HomeRedirect } from '../pages/HomeRedirect.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { CddRegisterPage } from '../pages/CddRegisterPage.jsx';
import { PlaceholderPage } from '../pages/PlaceholderPage.jsx';
import { placeholderRoutes, CDD_REGISTER_PATH, DEALS_PATH, CDD_SECTION_PATHS } from '../navigation/moduleRegistry.jsx';
import { DocumentModulePage, DOCUMENT_MODULES } from '../pages/documents/DocumentModulePage.jsx';
import { DocumentsLandingPage } from '../pages/documents/DocumentsLandingPage.jsx';
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

        {/* Documents — landing cards + versioned compliance registers (upload + history).
            Outside the CDD section, so restricted to the full-workspace roles. */}
        <Route path="/documents" element={
          <ProtectedRoute roles={FULL_WORKSPACE_ROLES}><DocumentsLandingPage /></ProtectedRoute>
        } />
        {DOCUMENT_MODULES.map((m) => (
          <Route
            key={m.path}
            path={m.path}
            element={
              <ProtectedRoute roles={FULL_WORKSPACE_ROLES}>
                <DocumentModulePage category={m.category} title={m.title} />
              </ProtectedRoute>
            }
          />
        ))}

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
                : <ProtectedRoute roles={FULL_WORKSPACE_ROLES}>{page}</ProtectedRoute>}
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
