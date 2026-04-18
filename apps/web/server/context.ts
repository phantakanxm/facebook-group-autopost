import { prisma } from '@app/db';

export async function createContext() {
  return { prisma, userId: 'default-user' };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
