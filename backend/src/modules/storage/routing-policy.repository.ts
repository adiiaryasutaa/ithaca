import { prisma } from '../../config/prisma.js';

export function findFirstRoutingPolicy() {
  return prisma.uploadRoutingPolicy.findFirst({ orderBy: { createdAt: 'asc' } });
}

export function createRoutingPolicy(data: {
  userId: string;
  mode: string;
  priorityAccountIds: string[];
}) {
  return prisma.uploadRoutingPolicy.create({ data });
}
