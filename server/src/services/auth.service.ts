import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { LoginInput } from '../validation/auth.schema';
import { getPermissionsForRole } from '../lib/permissions';

export async function login(data: LoginInput) {
  const { username, password } = data;
  const user = await prisma.user.findUnique({ where: { username }, include: { role: true } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedError("Nom d'utilisateur ou mot de passe incorrect");
  }

  if (user.status === 'INACTIVE') {
    throw new ForbiddenError('Compte désactivé');
  }

  if (user.isFirstLogin) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { resetPasswordToken: resetToken, resetPasswordExpires: resetPasswordExpires, lastLogin: new Date() } });
    return {
      requiresPasswordChange: true,
      token: resetToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role.name,
        avatar: user.avatar,
        permissions: await getPermissionsForRole(user.role.name),
      },
    };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role.name },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions
  );

  return {
    requiresPasswordChange: false,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role.name,
      avatar: user.avatar,
      permissions: await getPermissionsForRole(user.role.name),
    },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, name: true, role: { select: { name: true } }, avatar: true, status: true },
  });
  if (!user) throw new NotFoundError('Utilisateur');
  return { ...user, role: user.role.name, permissions: await getPermissionsForRole(user.role.name) };
}

export async function resetPassword(token: string, newPassword: string) {
  const { user } = await verifyResetToken(token);
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      isFirstLogin: false,
    },
  });
}

export async function verifyResetToken(token: string) {
  const user = await prisma.user.findFirst({
    where: { resetPasswordToken: token, resetPasswordExpires: { gte: new Date() } },
    include: { role: true },
  });

  if (!user) {
    throw new UnauthorizedError('Token de réinitialisation invalide ou expiré');
  }

  return {
    isValid: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role.name,
      avatar: user.avatar,
    },
  };
}