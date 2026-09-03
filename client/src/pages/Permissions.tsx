import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Plus, Pencil, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { usePermissions, useUpdateRolePermission } from '../hooks/usePermissions';
import { useRoles, useCreateRole, useUpdateRole } from '../hooks/useRoles';
import { PageLoader, PageError } from '../components/QueryLoader';
import { getApiErrorMessage } from '../lib/apiError';
import { PermissionEntry } from '../api/permissions';
import { RoleSummary } from '../api/roles';

export const Permissions: React.FC = () => {
  const { t } = useTranslation();
  const { data: permissions, isLoading, isError } = usePermissions();
  const { data: roles = [] } = useRoles();
  const updateRolePermission = useUpdateRolePermission();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [pendingCell, setPendingCell] = useState<string | null>(null);

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingName, setEditingName]     = useState('');
  const [roleError, setRoleError]         = useState('');

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName]   = useState('');

  if (isLoading) return <PageLoader />;
  if (isError)   return <PageError />;

  const domains = Array.from(new Set((permissions ?? []).map(p => p.domain)));

  const toggle = (permission: PermissionEntry, role: RoleSummary) => {
    const cellKey = `${permission.id}-${role.id}`;
    const granted = !permission.roleIds.includes(role.id);
    setCellErrors(prev => { const next = { ...prev }; delete next[cellKey]; return next; });
    setPendingCell(cellKey);
    updateRolePermission.mutate(
      { permissionId: permission.id, roleId: role.id, granted },
      {
        onError: (err) => {
          setCellErrors(prev => ({ ...prev, [cellKey]: getApiErrorMessage(err, t('common.error')) }));
        },
        onSettled: () => setPendingCell(null),
      },
    );
  };

  const startRename = (role: RoleSummary) => {
    setEditingRoleId(role.id);
    setEditingName(role.name);
    setRoleError('');
  };

  const cancelRename = () => { setEditingRoleId(null); setEditingName(''); setRoleError(''); };

  const saveRename = () => {
    if (!editingRoleId || !editingName.trim()) return;
    updateRole.mutate(
      { id: editingRoleId, payload: { name: editingName.trim() } },
      {
        onSuccess: cancelRename,
        onError:   (err) => setRoleError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  const saveNewRole = () => {
    if (!newRoleName.trim()) return;
    setRoleError('');
    createRole.mutate(
      { name: newRoleName.trim() },
      {
        onSuccess: () => { setIsAddingRole(false); setNewRoleName(''); },
        onError:   (err) => setRoleError(getApiErrorMessage(err, t('common.error'))),
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

      {roleError && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{roleError}
        </div>
      )}

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
                  {roles.map(role => (
                    <th key={role.id} className="px-4 py-3 text-[9px] font-bold tracking-widest uppercase text-on-surface-variant/40 text-center">
                      {editingRoleId === role.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
                            className="w-20 px-1.5 py-1 border border-primary/40 rounded-md text-[9px] normal-case font-normal text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                          <button onClick={saveRename} disabled={updateRole.isPending} className="text-teal-600 hover:text-teal-700 disabled:opacity-40">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={cancelRename} className="text-on-surface-variant/40 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startRename(role)} className="inline-flex items-center gap-1 hover:text-primary transition-colors group">
                          {role.name}
                          <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">
                    {domain === domains[0] && (
                      isAddingRole ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            autoFocus
                            value={newRoleName}
                            placeholder={t('permissions.newRolePlaceholder')}
                            onChange={e => setNewRoleName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveNewRole(); if (e.key === 'Escape') setIsAddingRole(false); }}
                            className="w-24 px-1.5 py-1 border border-primary/40 rounded-md text-[9px] normal-case font-normal focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                          <button onClick={saveNewRole} disabled={createRole.isPending} className="text-teal-600 hover:text-teal-700 disabled:opacity-40">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => { setIsAddingRole(false); setNewRoleName(''); }} className="text-on-surface-variant/40 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setIsAddingRole(true)} title={t('permissions.newRole')}
                          className="p-1.5 rounded-full text-on-surface-variant/40 hover:text-primary hover:bg-stone-50 transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(permissions ?? []).filter(p => p.domain === domain).map(permission => (
                  <tr key={permission.id}>
                    <td className="px-6 py-4">
                      <p className="text-xs font-semibold text-on-surface">{permission.description}</p>
                      <p className="text-[9px] font-mono text-on-surface-variant/30 mt-0.5">{permission.key}</p>
                      {roles.map(role => {
                        const cellKey = `${permission.id}-${role.id}`;
                        return cellErrors[cellKey] ? (
                          <p key={role.id} className="flex items-center gap-1.5 text-[10px] text-red-500 mt-1">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {cellErrors[cellKey]}
                          </p>
                        ) : null;
                      })}
                    </td>
                    {roles.map(role => {
                      const cellKey = `${permission.id}-${role.id}`;
                      const checked = permission.roleIds.includes(role.id);
                      return (
                        <td key={role.id} className="px-4 py-4 text-center">
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
                    <td />
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
