import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Globe,
  Bell,
  Shield,
  Palette,
  Save,
  Building2,
  MapPin,
  ChevronRight,
  Database
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('property');
  const [isSaving, setIsSaving] = useState(false);

  const SECTIONS = [
    { id: 'property',      label: t('settings.sections.property',      'Identité propriété'), icon: Building2 },
    { id: 'localization',  label: t('settings.sections.localization',  'Localisation'),       icon: Globe },
    { id: 'notifications', label: t('settings.sections.notifications', 'Notifications'),      icon: Bell },
    { id: 'security',      label: t('settings.sections.security',      'Sécurité & Accès'),  icon: Shield },
    { id: 'appearance',    label: t('settings.sections.appearance',    'Design interface'),   icon: Palette },
  ];

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-1 leading-none">{t('settings.systemCore')}</h2>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">{t('settings.configure')}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-zinc-900 text-white px-8 py-3.5 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/10 disabled:opacity-50"
        >
          {isSaving ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Save className="w-4 h-4" />
            </motion.div>
          ) : <Save className="w-4 h-4" />}
          {isSaving ? t('settings.syncing') : t('settings.saveConfiguration')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-1 space-y-2">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all group border",
                activeSection === section.id 
                  ? "bg-white border-stone-200 shadow-sm text-primary" 
                  : "bg-transparent border-transparent text-on-surface-variant/60 hover:bg-stone-50"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                activeSection === section.id ? "bg-primary text-white" : "bg-stone-100 text-stone-400 group-hover:bg-stone-200"
              )}>
                <section.icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest">{section.label}</span>
              <ChevronRight className={cn(
                "w-4 h-4 ml-auto transition-transform",
                activeSection === section.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
              )} />
            </button>
          ))}

          <div className="pt-10 px-4">
             <div className="p-5 bg-stone-900 rounded-3xl text-white organic-shadow">
                <Database className="w-6 h-6 text-teal-400 mb-4" />
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Build Identifier</p>
                <p className="font-mono text-[10px] opacity-80 mb-4">v2.4.1-stable.prod</p>
                <button className="text-[9px] font-bold text-teal-400 uppercase tracking-widest hover:underline">Check for Updates</button>
             </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="lg:col-span-3">
          <div className="bg-white rounded-[2.5rem] border border-stone-200/60 organic-shadow overflow-hidden">
             
             {/* Property Section */}
             {activeSection === 'property' && (
               <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 md:p-12 space-y-12"
               >
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-6 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" /> General Information
                      </h3>
                      <div className="space-y-4">
                        <div className="group">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-2 px-1">Retreat Name</label>
                          <input 
                            type="text" 
                            defaultValue="Natura Lodge Highland Retreat"
                            className="w-full h-14 px-5 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-display italic text-xl"
                          />
                        </div>
                        <div className="group">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-2 px-1">Official Website</label>
                          <input 
                            type="text" 
                            defaultValue="https://natura-lodge.com"
                            className="w-full h-12 px-5 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-6 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" /> Contact Details
                      </h3>
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-2 px-1">Inquiry Phone</label>
                            <input type="text" defaultValue="+41 22 567 8900" className="w-full h-12 px-5 bg-stone-50 border border-stone-100 rounded-2xl text-sm" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-2 px-1">Concierge Email</label>
                            <input type="text" defaultValue="guest@naturalodge.com" className="w-full h-12 px-5 bg-stone-50 border border-stone-100 rounded-2xl text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-2 px-1">Physical Address</label>
                          <textarea 
                            rows={3} 
                            defaultValue="Via Alpina 42, Saint-Moritz, Switzerland"
                            className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl text-sm outline-none focus:border-primary transition-all resize-none"
                          />
                        </div>
                      </div>
                   </div>
                 </div>

                 <div className="pt-10 border-t border-stone-100">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-8">Digital Signature</h3>
                    <div className="flex items-center gap-8">
                       <div className="w-32 h-32 bg-stone-900 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl relative group overflow-hidden">
                          <span className="font-display italic text-2xl text-white">Natura</span>
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[9px] font-bold uppercase tracking-widest text-white">
                            Upload
                          </div>
                       </div>
                       <div className="space-y-1">
                          <p className="text-sm font-semibold">Primary Logo (SVG/PNG)</p>
                          <p className="text-[10px] text-on-surface-variant/40 max-w-xs leading-relaxed">
                            Used in guest guest confirmation emails, invoices, and tablet interfaces. Recommended size: 512x512px.
                          </p>
                       </div>
                    </div>
                 </div>
               </motion.div>
             )}

             {/* Localisation section — language switcher */}
             {activeSection === 'localization' && (
               <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="p-8 md:p-12 space-y-8"
               >
                 <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-6 flex items-center gap-2">
                   <Globe className="w-4 h-4 text-primary" /> {t('settings.language')}
                 </h3>
                 <div className="flex items-center gap-6">
                   <p className="text-sm text-on-surface-variant font-light">{t('settings.language')}</p>
                   <LanguageSwitcher />
                 </div>
               </motion.div>
             )}

             {/* Placeholder for other sections */}
             {activeSection !== 'property' && activeSection !== 'localization' && (
               <div className="p-20 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-stone-50 flex items-center justify-center mb-6">
                     {SECTIONS.find(s => s.id === activeSection)?.icon && React.createElement(SECTIONS.find(s => s.id === activeSection)!.icon, { className: "w-8 h-8 text-on-surface-variant/20" })}
                  </div>
                  <h3 className="font-display italic text-2xl text-on-surface mb-2">{SECTIONS.find(s => s.id === activeSection)?.label}</h3>
                  <p className="text-xs text-on-surface-variant/60 max-w-xs mx-auto leading-relaxed">
                    This administrative module is currently being optimized for high-security environments. Deployment expected in version 2.5.
                  </p>
                  <button className="mt-8 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Request Early Access</button>
               </div>
             )}
          </div>

          <div className="mt-8 flex items-center gap-4 p-6 bg-amber-50 border border-amber-100 rounded-[2rem]">
             <Shield className="w-5 h-5 text-amber-600" />
             <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Pending Safety Audit</p>
                <p className="text-[11px] text-amber-900/60 font-medium">Your account was last audited for security compliance on May 12, 2026. A new audit is scheduled in 3 days.</p>
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};
