import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { processWebsiteRequest } from '../api/websiteRequests';
import { INVOICES_KEY } from '../hooks/useInvoices';
import { BOOKINGS_KEY } from '../hooks/useBookings';
import { getApiErrorMessage } from '../lib/apiError';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  request: { id: string; reference: string } | null;
  onClose: () => void;
}

// Confirmation manuelle d'une demande du site une fois son acompte reçu : l'encaissement ne la
// confirme plus tout seul. Confirmer passe le séjour en « confirmé » et envoie l'email au client.
export const ConfirmWebsiteRequestModal: React.FC<Props> = ({ request, onClose }) => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const confirm = useMutation({
    mutationFn: (id: string) => processWebsiteRequest({ id, action: 'confirm' }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['website-requests'] }),
        qc.invalidateQueries({ queryKey: INVOICES_KEY }),
        qc.invalidateQueries({ queryKey: BOOKINGS_KEY }),
      ]);
      onClose();
    },
    onError: (err) => setError(getApiErrorMessage(err, t('common.error'))),
  });

  return (
    <ConfirmModal
      isOpen={!!request}
      onClose={() => { setError(''); onClose(); }}
      onConfirm={() => { setError(''); if (request) confirm.mutate(request.id); }}
      title={t('websiteRequests.confirmAfterDepositTitle')}
      message={t('websiteRequests.confirmAfterDepositMessage', { reference: request?.reference ?? '' })}
      confirmLabel={t('websiteRequests.confirmNow')}
      cancelLabel={t('websiteRequests.confirmLater')}
      variant="warning"
      isPending={confirm.isPending}
    >
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    </ConfirmModal>
  );
};
