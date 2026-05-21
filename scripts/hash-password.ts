import { hashPassword } from '../lib/admin-auth';

async function main() {
  const pw = process.argv[2];
  if (!pw) {
    console.error('Usage: tsx scripts/hash-password.ts <plain-password>');
    process.exit(1);
  }
  // hashPassword doesn't use the JWT secret, but module load needs it set
  process.env.ADMIN_JWT_SECRET = 'a'.repeat(32);
  const hash = await hashPassword(pw);
  console.log(hash);
}
main();
