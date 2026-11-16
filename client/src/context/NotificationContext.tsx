import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export interface AppNotification {
  id: string;
  source: 'direct' | 'ota' | 'member' | 'system';
  title: string;
  subtitle: string;
  amount: string;
  read: boolean;
  createdAt: Date;
  // Page opened when the notification is clicked.
  link?: string;
  // Server-side event id: the same event delivered twice (polling overlap, several tabs) is added once.
  externalId?: string;
}

interface NotificationContextProps {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'> & { createdAt?: Date }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('hotel_notifications');
    if (saved) {
      try {
        const parsed: AppNotification[] = JSON.parse(saved);
        return parsed.map((n) => ({ ...n, createdAt: new Date(n.createdAt) }));
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('hotel_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'> & { createdAt?: Date }) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      read: false,
      createdAt: notif.createdAt ?? new Date(),
    };
    setNotifications(prev => (newNotif.externalId && prev.some(n => n.externalId === newNotif.externalId) ? prev : [newNotif, ...prev].slice(0, 100)));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearNotification, clearAll }),
    [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearNotification, clearAll]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
