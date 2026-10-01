import { seedIfEmpty } from './seed.ts';
await seedIfEmpty(process.argv.includes('--force'));
console.log('Seed complete.');
