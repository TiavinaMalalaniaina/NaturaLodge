import React, { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { usePermissions, useUpdateRolePermission } from '../hooks/usePermissions';
import { PageLoader, PageError } from '../components/QueryLoader';
import { getApiErrorMessage } from '../lib/apiError';
import { UserRole } from '../context/AuthContext';
import { PermissionEntry } from '../api/permissions';

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'];

export const Permissions: React.FC = () => {
  const { t } = useTranslation();
  const { data: permissions, isLoading, isError } = usePermissions();
  const updateRolePermission = useUpdateRolePermission();

  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [pendingCell, setPendingCell] = useState<string | null>(null);

  if (isLoading) return <PageLoader />;
  if (isError)   return <PageError />;

  const domains = Array.from(new Set((permissions ?? []).map(p => p.domain)));

  const toggle = (permission: PermissionEntry, role: UserRole) => {
    const cellKey = `${permission.id}-${role}`;
    const granted = !permission.roles.includes(role);
    setCellErrors(prev => { const next = { ...prev }; delete next[cellKey]; return next; });
    setPendingCell(cellKey);
    updateRolePermission.mutate(
      { permissionId: permission.id, role, granted },
      {
        onError: (err) => {
          setCellErrors(prev => ({ ...prev, [cellKey]: getApiErrorMessage(err, t('common.error')) }));
        },
        onSettled: () => setPendingCell(null),
      },
    );
  };

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('permissions.title')}</h2>
        <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
          {t('permissions.hint')}
        </p>
      </div>

      {domains.map(domain => (
        <div key={domain} className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-on-surface-variant/50" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{domain}</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-stone-50/50 border-b border-stone-100">
                  <th className="px-6 py-3 text-[9px] font-bold tracking-widest uppercase text-on-surface-variant/40">{t('permissions.action')}</th>
                  {ROLES.map(role => (
                    <th key={role} className="px-4 py-3 text-[9px] font-bold tracking-widest uppercase text-on-surface-variant/40 text-center">{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(permissions ?? []).filter(p => p.domain === domain).map(permission => (
                  <tr key={permission.id}>
                    <td className="px-6 py-4">
                      <p className="text-xs font-semibold text-on-surface">{permission.description}</p>
                      <p className="text-[9px] font-mono text-on-surface-variant/30 mt-0.5">{permission.key}</p>
                      {ROLES.map(role => {
                        const cellKey = `${permission.id}-${role}`;
                        return cellErrors[cellKey] ? (
                          <p key={role} className="flex items-center gap-1.5 text-[10px] text-red-500 mt-1">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {cellErrors[cellKey]}
                          </p>
                        ) : null;
                      })}
                    </td>
                    {ROLES.map(role => {
                      const cellKey = `${permission.id}-${role}`;
                      const checked = permission.roles.includes(role);
                      return (
                        <td key={role} className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={pendingCell === cellKey}
                            onChange={() => toggle(permission, role)}
                            className={cn(
                              'w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary/30 cursor-pointer',
                              pendingCell === cellKey && 'opacity-40',
                            )}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
