import React from 'react';

export const PageLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-32 text-on-surface-variant/40">
    <div className="w-10 h-10 bg-primary rotate-45 rounded-xl animate-pulse mb-6" />
    <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em]">Chargement...</p>
  </div>
);

export const PageError: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-32 text-red-400">
    <p className="font-display italic text-2xl mb-2">Erreur de chargement</p>
    <p className="text-xs">{message ?? 'Vérifiez que le backend est démarré.'}</p>
  </div>
);
