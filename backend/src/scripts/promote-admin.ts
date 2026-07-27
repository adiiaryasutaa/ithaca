import { prisma } from '../config/prisma.js';
import { normalizeEmail } from '../utils/email.js';

async function main() {
  const rawEmail = process.argv[2];
  if (!rawEmail) throw new Error('Usage: tsx src/scripts/promote-admin.ts <email>');
  const email = normalizeEmail(rawEmail);

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
