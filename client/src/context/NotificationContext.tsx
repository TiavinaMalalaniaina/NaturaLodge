import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AppNotification {
  id: string;
  source: 'direct' | 'ota' | 'member' | 'system';
  title: string;
  subtitle: string;
  amount: string;
  time: string;
  read: boolean;
  createdAt: Date;
}

interface NotificationContextProps {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'createdAt' | 'time'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    source: 'direct',
    title: 'New Direct Stay',
    subtitle: 'L. Hamilton • 4 nights • Room 101',
    amount: '6,200,000 Ar',
    time: 'Just now',
    read: false,
    createdAt: new Date(),
  },
  {
    id: 'notif-2',
    source: 'ota',
    title: 'Booking.com Rev',
    subtitle: 'J. Doe • 2 nights • Room 304',
    amount: '2,250,000 Ar',
    time: '12m ago',
    read: false,
    createdAt: new Date(Date.now() - 12 * 60 * 1000),
  },
  {
    id: 'notif-3',
    source: 'member',
    title: 'Loyalty Upgrade',
    subtitle: 'A. Smith • Platinum • VIP Elite Status',
    amount: '--',
    time: '45m ago',
    read: true,
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
  },
];

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('hotel_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }));
      } catch (e) {
        return INITIAL_NOTIFICATIONS;
      }
    }
    return INITIAL_NOTIFICATIONS;
  });

  useEffect(() => {
    localStorage.setItem('hotel_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Periodically update the human-readable text relative times if necessary
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev =>
        prev.map(notif => {
          const diffMs = Date.now() - notif.createdAt.getTime();
          const diffMins = Math.floor(diffMs / (60 * 1000));
          
          let timeString = notif.time;
          if (diffMins < 1) {
            timeString = 'Just now';
          } else if (diffMins < 60) {
            timeString = `${diffMins}m ago`;
          } else {
            const diffHours = Math.floor(diffMins / 60);
            timeString = `${diffHours}h ago`;
          }
          return { ...notif, time: timeString };
        })
      );
    }, 30000); // every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = (notif: Omit<AppNotification, 'id' | 'read' | 'createdAt' | 'time'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      time: 'Just now',
      read: false,
      createdAt: new Date(),
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
      }}
    >
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
