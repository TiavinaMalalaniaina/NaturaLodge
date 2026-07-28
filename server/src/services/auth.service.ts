import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { LoginInput } from '../validation/auth.schema';

export async function login(data: LoginInput) {
  const { email, password } = data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  if (user.status === 'INACTIVE') {
    throw new ForbiddenError('Compte désactivé');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions
  );

  return {
    token,
    user: {
      id:     user.id,
      email:  user.email,
      name:   user.name,
      role:   user.role,
      avatar: user.avatar,
    },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, avatar: true, status: true },
  });
  if (!user) throw new NotFoundError('Utilisateur');
  return user;
}
