import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FlashbarProvider } from './context/FlashbarContext';
import { HomePage } from './pages/HomePage';
import { BucketsPage } from './services/s3/BucketsPage';
import { BucketDetailPage } from './services/s3/BucketDetailPage';
import { SecurityGroupsPage } from './services/ec2/SecurityGroupsPage';
import { SecurityGroupDetailPage } from './services/ec2/SecurityGroupDetailPage';
import { EditInboundRulesPage } from './services/ec2/EditInboundRulesPage';
import { PortalConsoleProvider } from './context/PortalConsoleContext';
import { AdminEventDetailPage, AdminEventsPage, AdminLoginPage } from './pages/AdminPages';
import { EnterPage, LobbyPage, SubmittedPage } from './pages/PortalPages';
import { AdminEnterPage } from './pages/AdminEnterPage';

export const App: React.FC = () => {
  const standalone = import.meta.env.VITE_STANDALONE === 'true';

  if (standalone) {
    return (
      <FlashbarProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/s3" replace />} />
            <Route path="/console" element={<Navigate to="/s3" replace />} />
            <Route path="/s3" element={<BucketsPage />} />
            <Route path="/s3/buckets/:name" element={<BucketDetailPage />} />
            <Route path="/ec2/security-groups" element={<SecurityGroupsPage />} />
            <Route path="/ec2/security-groups/:id" element={<SecurityGroupDetailPage />} />
            <Route path="/ec2/security-groups/:id/edit-inbound" element={<EditInboundRulesPage />} />
            <Route path="*" element={<Navigate to="/s3" replace />} />
          </Routes>
        </BrowserRouter>
      </FlashbarProvider>
    );
  }

  return (
    <FlashbarProvider>
      <BrowserRouter>
        <PortalConsoleProvider enabled={true}>
          <Routes>
          {/* Participant portal */}
          <Route path="/enter" element={<EnterPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/console" element={<HomePage />} />
          <Route path="/submitted" element={<SubmittedPage />} />

          {/* Admin portal */}
          <Route path="/admin/enter" element={<AdminEnterPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/events" element={<AdminEventsPage />} />
          <Route path="/admin/events/:id" element={<AdminEventDetailPage />} />

          {/* Home */}
          <Route path="/" element={<Navigate to="/enter" replace />} />

          {/* S3 */}
          <Route path="/s3" element={<BucketsPage />} />
          <Route path="/s3/buckets/:name" element={<BucketDetailPage />} />

          {/* EC2 */}
          <Route path="/ec2/security-groups" element={<SecurityGroupsPage />} />
          <Route path="/ec2/security-groups/:id" element={<SecurityGroupDetailPage />} />
          <Route path="/ec2/security-groups/:id/edit-inbound" element={<EditInboundRulesPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PortalConsoleProvider>
      </BrowserRouter>
    </FlashbarProvider>
  );
};

export default App;
