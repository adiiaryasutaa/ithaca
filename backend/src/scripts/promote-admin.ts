import { prisma } from '../config/prisma.js';

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('Usage: tsx src/scripts/promote-admin.ts <email>');

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin' },
    select: { id: true, email: true, role: true },
  });

  console.log(`Promoted ${user.email} to ${user.role} (${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
