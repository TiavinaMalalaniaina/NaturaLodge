import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Search, Filter, Shield, MoreVertical, Mail, Clock, Key, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStaff } from '../hooks/useStaff';
import { AddStaffModal } from '../components/AddStaffModal';
import { PageLoader, PageError } from '../components/QueryLoader';

export const Staff: React.FC = () => {
  const { data: staffList = [], isLoading, isError } = useStaff();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  if (isLoading) return <PageLoader />;
  if (isError) return <PageError />;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-1 leading-none">Internal Cabinet</h2>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">Manage staff access & roles</p>
        </div>
        <button 
           onClick={() => setIsAddModalOpen(true)}
           className="bg-zinc-900 text-white px-8 py-3.5 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/10"
        >
          <UserPlus className="w-4 h-4" /> Grant Access
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {[
           { label: 'Active Personnel', value: '42', delta: '+2', icon: Shield, color: 'text-primary' },
           { label: 'Live Sessions', value: '18', delta: 'Peak', icon: Activity, color: 'text-teal-500' },
           { label: 'Access Requests', value: '0', delta: 'Secure', icon: Key, color: 'text-amber-500' },
         ].map((stat, i) => (
           <div key={i} className="bg-white p-6 rounded-3xl border border-stone-200/60 organic-shadow flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">{stat.label}</p>
                <div className="flex items-end gap-2">
                   <span className="text-3xl font-display italic">{stat.value}</span>
                   <span className="text-[9px] font-bold text-teal-600 mb-1">{stat.delta}</span>
                </div>
              </div>
              <div className={cn("w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center", stat.color)}>
                 <stat.icon className="w-6 h-6" />
              </div>
           </div>
         ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-stone-200/60 overflow-hidden organic-shadow">
        <div className="p-8 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="relative flex-1 max-w-md">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
             <input 
              type="text" 
              placeholder="Search member by name or role..." 
              className="w-full h-12 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none text-sm transition-all"
             />
           </div>
           <div className="flex items-center gap-4">
              <button className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-on-surface-variant hover:bg-stone-100 transition-colors">
                <Filter className="w-4 h-4" />
              </button>
              <div className="h-8 w-[1px] bg-stone-200 mx-2 hidden md:block" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Showing {staffList.length} Members</p>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Personnel</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Authorization</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Condition</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 text-right">Activity</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {staffList.map((member) => (
                <tr key={member.id} className="group hover:bg-stone-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{member.name}</p>
                        <p className="text-[10px] font-light text-on-surface-variant/60 flex items-center gap-1.5">
                          <Mail className="w-3 h-3" /> {member.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border",
                      member.role === 'admin' ? "bg-zinc-900 text-white border-zinc-900" :
                      member.role === 'manager' ? "bg-teal-50 text-teal-600 border-teal-200" :
                      "bg-stone-50 text-stone-500 border-stone-200"
                    )}>
                      {member.role === 'admin' ? 'Superuser' : member.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                     <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", 
                          member.status === 'active' ? "bg-teal-500 shadow-sm shadow-teal-500/50" :
                          member.status === 'on-leave' ? "bg-amber-400" : "bg-stone-300"
                        )} />
                        <span className="text-xs text-on-surface/80 capitalize">{member.status.replace('-', ' ')}</span>
                     </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <p className="text-xs text-on-surface-variant font-light flex items-center justify-end gap-1.5">
                      <Clock className="w-3 h-3 opacity-40" /> {member.lastLogin}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-tighter opacity-20 mt-1">Joined {member.joinedDate}</p>
                  </td>
                  <td className="px-8 py-5 text-right w-10">
                    <button className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-stone-200 group-hover:text-primary">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-8 bg-stone-50/50 flex justify-center">
           <button className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 hover:text-primary transition-all">
             Audit Full Personnel History
           </button>
        </div>
      </div>
      <AddStaffModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
};
