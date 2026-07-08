import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Reservations } from './pages/Reservations';
import { NewReservation } from './pages/NewReservation';
import { Guests } from './pages/Guests';
import { GuestProfile } from './pages/GuestProfile';
import { Rooms } from './pages/Rooms';
import { RoomDetail } from './pages/RoomDetail';
import { BookingDetail } from './pages/BookingDetail';
import { Amenities } from './pages/Amenities';
import { Staff } from './pages/Staff';
import { Invoices } from './pages/Invoices';
import { InvoiceView } from './pages/InvoiceView';
import { Settings } from './pages/Settings';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
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
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
