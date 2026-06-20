import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { LandingPage } from '../pages/LandingPage.jsx';
import { PricingPage } from '../pages/PricingPage.jsx';
import { ContactPage } from '../pages/ContactPage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { AdminLoginPage } from '../pages/AdminLoginPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import {
  DEAL_AUTHOR_ROLES, DEAL_REVIEWER_ROLES, USER_MANAGER_ROLES,
} from '../auth/roles.js';
import { HomeRedirect } from '../pages/HomeRedirect.jsx';
import { UsersAdminPage } from '../pages/admin/UsersAdminPage.jsx';
import { FirmsAdminPage } from '../pages/admin/FirmsAdminPage.jsx';
import { AuditAdminPage } from '../pages/admin/AuditAdminPage.jsx';
import { MyDealsPage } from '../pages/MyDealsPage.jsx';
import { QueuePage } from '../pages/QueuePage.jsx';
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
        <Route path="/profile" element={<ProfilePage />} />

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

        <Route path="/queue" element={
          <ProtectedRoute roles={['ROOT', ...DEAL_REVIEWER_ROLES]}>
            <QueuePage />
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

        <Route path="/admin/users" element={
          <ProtectedRoute roles={USER_MANAGER_ROLES}>
            <UsersAdminPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/firms" element={
          <ProtectedRoute roles={['ROOT']}>
            <FirmsAdminPage />
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
