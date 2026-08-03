import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, TopBar } from './Navigation';
import { motion } from 'motion/react';

export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-stone-50 flex overflow-x-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen min-w-0 transition-all duration-300">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-10 overflow-x-hidden min-w-0">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full min-w-0"
          >
            <Outlet />
          </motion.div>
        </main>
        <footer className="no-print px-10 py-8 text-center border-t border-stone-200 mt-auto font-sans text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-[0.4em]">
          Natura Lodge Systems • Version 0.0.1 • Built with Organic Precision
        </footer>
      </div>
    </div>
  );
};
