import { z } from 'zod';
import { Role } from '@prisma/client';

export const updatePermissionSchema = z.object({
  permissionId: z.string().min(1),
  role:         z.nativeEnum(Role),
  granted:      z.boolean(),
});

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
