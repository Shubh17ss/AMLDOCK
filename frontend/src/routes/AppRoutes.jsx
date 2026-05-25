import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { HomeRedirect } from '../pages/HomeRedirect.jsx';
import { UsersAdminPage } from '../pages/admin/UsersAdminPage.jsx';
import { FirmsAdminPage } from '../pages/admin/FirmsAdminPage.jsx';
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
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route path="/my-deals" element={
          <ProtectedRoute roles={['BROKER']}>
            <MyDealsPage />
          </ProtectedRoute>
        } />
        <Route path="/deals/new" element={
          <ProtectedRoute roles={['BROKER']}>
            <NewDealWizardPage />
          </ProtectedRoute>
        } />
        <Route path="/deals/:id" element={<DealDetailPage />} />
        <Route path="/deals/:id/review" element={
          <ProtectedRoute roles={['COMPLIANCE', 'MANAGER']}>
            <DealReviewScreen />
          </ProtectedRoute>
        } />

        <Route path="/queue" element={
          <ProtectedRoute roles={['COMPLIANCE', 'MANAGER']}>
            <QueuePage />
          </ProtectedRoute>
        } />
        <Route path="/firm/deals" element={
          <ProtectedRoute roles={['FIRM_USER']}>
            <FirmDealsPage />
          </ProtectedRoute>
        } />
        <Route path="/firm/deals/:id" element={
          <ProtectedRoute roles={['FIRM_USER']}>
            <DealDetailPage />
          </ProtectedRoute>
        } />

        <Route path="/admin/users" element={
          <ProtectedRoute roles={['MANAGER']}>
            <UsersAdminPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/firms" element={
          <ProtectedRoute roles={['MANAGER']}>
            <FirmsAdminPage />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
