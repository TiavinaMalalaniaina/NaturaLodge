import { useQuery, useMutation } from '@tanstack/react-query';
import { verifyResetToken, resetPassword } from '../api/resetPassword';

export function useVerifyResetPasswordToken(token: string | null) {
  return useQuery({
    queryKey: ['reset-password-token', token],
    queryFn: () => verifyResetToken(token!),
    enabled: !!token,
    retry: false,
    staleTime: 0,           
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: resetPassword,
  });
}