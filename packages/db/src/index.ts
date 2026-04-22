// @prisma/client v5 ships as CJS only; under NodeNext ESM strict mode, named
// imports fail at runtime with "Named export 'PrismaClient' not found". Use a
// default-import + destructure pattern so Node's CJS interop works.
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

declare global {
  var __prisma: InstanceType<typeof PrismaClient> | undefined;
}

export const prisma =
  globalThis.__prisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;
