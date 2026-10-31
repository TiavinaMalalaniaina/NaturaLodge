import { AuthUser } from '../context/AuthContext';
import { api } from './client';

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export const resetPassword = async (payload: ResetPasswordPayload): Promise<void> => {
    await api.patch('/auth/reset-password', {
        body: payload,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

export const verifyResetToken = async (token: string): Promise<{ user: AuthUser }> => {
    const response = await api.get<{ user: AuthUser }>(`/auth/verify-reset-token?token=${token}`);
    return response.data;
}
