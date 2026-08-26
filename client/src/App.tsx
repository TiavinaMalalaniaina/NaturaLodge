import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoader } from './components/QueryLoader';
import { LoginPage } from './pages/Login';

const Dashboard      = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Reservations   = lazy(() => import('./pages/Reservations').then(m => ({ default: m.Reservations })));
const NewReservation = lazy(() => import('./pages/NewReservation').then(m => ({ default: m.NewReservation })));
const Guests         = lazy(() => import('./pages/Guests').then(m => ({ default: m.Guests })));
const GuestProfile    = lazy(() => import('./pages/GuestProfile').then(m => ({ default: m.GuestProfile })));
const Rooms          = lazy(() => import('./pages/Rooms').then(m => ({ default: m.Rooms })));
const RoomTypes       = lazy(() => import('./pages/RoomTypes').then(m => ({ default: m.RoomTypes })));
const RoomDetail      = lazy(() => import('./pages/RoomDetail').then(m => ({ default: m.RoomDetail })));
const BookingDetail   = lazy(() => import('./pages/BookingDetail').then(m => ({ default: m.BookingDetail })));
const Amenities       = lazy(() => import('./pages/Amenities').then(m => ({ default: m.Amenities })));
const Staff          = lazy(() => import('./pages/Staff').then(m => ({ default: m.Staff })));
const Invoices        = lazy(() => import('./pages/Invoices').then(m => ({ default: m.Invoices })));
const Payments        = lazy(() => import('./pages/Payments').then(m => ({ default: m.Payments })));
const InvoiceView     = lazy(() => import('./pages/InvoiceView').then(m => ({ default: m.InvoiceView })));
const Settings        = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Expenses         = lazy(() => import('./pages/Expenses').then(m => ({ default: m.Expenses })));
const Treasury          = lazy(() => import('./pages/Treasury').then(m => ({ default: m.Treasury })));
const Reports            = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const AuditLog            = lazy(() => import('./pages/AuditLog').then(m => ({ default: m.AuditLog })));
const Permissions          = lazy(() => import('./pages/Permissions').then(m => ({ default: m.Permissions })));

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="reservations" element={<Reservations />} />
                  <Route element={<ProtectedRoute permission="bookings.create" />}>
                    <Route path="reservations/new" element={<NewReservation />} />
                  </Route>
                  <Route path="reservations/:id" element={<BookingDetail />} />
                  <Route path="rooms" element={<Rooms />} />
                  <Route path="rooms/types" element={<RoomTypes />} />
                  <Route path="rooms/:id" element={<RoomDetail />} />
                  <Route path="guests" element={<Guests />} />
                  <Route path="guests/:id" element={<GuestProfile />} />
                  <Route path="amenities" element={<Amenities />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="invoices/:bookingId" element={<InvoiceView />} />
                  <Route path="settings" element={<Settings />} />

                  <Route element={<ProtectedRoute permission="staff.view" />}>
                    <Route path="staff" element={<Staff />} />
                  </Route>
                  <Route element={<ProtectedRoute permission="expenses.view" />}>
                    <Route path="expenses" element={<Expenses />} />
                  </Route>
                  <Route element={<ProtectedRoute permission="ledger.view_reports" />}>
                    <Route path="treasury" element={<Treasury />} />
                    <Route path="reports" element={<Reports />} />
                  </Route>
                  <Route element={<ProtectedRoute permission="auditLogs.view" />}>
                    <Route path="audit-log" element={<AuditLog />} />
                  </Route>
                  <Route element={<ProtectedRoute permission="permissions.manage" />}>
                    <Route path="permissions" element={<Permissions />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
