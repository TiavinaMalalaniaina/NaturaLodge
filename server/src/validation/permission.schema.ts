import { z } from 'zod';

export const updatePermissionSchema = z.object({
  permissionId: z.string().min(1),
  roleId:       z.string().min(1),
  granted:      z.boolean(),
});

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
