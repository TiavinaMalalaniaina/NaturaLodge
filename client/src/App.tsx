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
const RoomDetail      = lazy(() => import('./pages/RoomDetail').then(m => ({ default: m.RoomDetail })));
const BookingDetail   = lazy(() => import('./pages/BookingDetail').then(m => ({ default: m.BookingDetail })));
const Amenities       = lazy(() => import('./pages/Amenities').then(m => ({ default: m.Amenities })));
const Staff          = lazy(() => import('./pages/Staff').then(m => ({ default: m.Staff })));
const Invoices        = lazy(() => import('./pages/Invoices').then(m => ({ default: m.Invoices })));
const InvoiceView     = lazy(() => import('./pages/InvoiceView').then(m => ({ default: m.InvoiceView })));
const Settings        = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

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
                  <Route path="reservations/new" element={<NewReservation />} />
                  <Route path="reservations/:id" element={<BookingDetail />} />
                  <Route path="rooms" element={<Rooms />} />
                  <Route path="rooms/:id" element={<RoomDetail />} />
                  <Route path="guests" element={<Guests />} />
                  <Route path="guests/:id" element={<GuestProfile />} />
                  <Route path="amenities" element={<Amenities />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="invoices/:bookingId" element={<InvoiceView />} />
                  <Route path="settings" element={<Settings />} />

                  <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']} />}>
                    <Route path="staff" element={<Staff />} />
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
