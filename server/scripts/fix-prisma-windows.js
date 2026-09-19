import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prismaRootDir = path.resolve(__dirname, '..', '..', 'node_modules', '.prisma');
const prismaClientDir = path.join(prismaRootDir, 'client');

function removeDirectory(target) {
  if (!fs.existsSync(target)) return;

  try {
    fs.rmSync(target, { recursive: true, force: true });
    console.log('Removed Prisma cache directory:', target);
  } catch (error) {
    console.warn('Could not remove Prisma cache directory:', target, error instanceof Error ? error.message : String(error));
  }
}

function removeTmpFiles(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      removeTmpFiles(full);
      continue;
    }

    if (/query_engine-windows\.dll\.node\.tmp/i.test(entry.name)) {
      try {
        fs.rmSync(full, { force: true, recursive: true });
        console.log('Removed temp Prisma file:', full);
      } catch (error) {
        console.warn('Could not remove temp Prisma file:', full, error instanceof Error ? error.message : String(error));
      }
    }
  }
}

removeTmpFiles(prismaClientDir);
removeDirectory(prismaClientDir);
removeDirectory(prismaRootDir);

console.log('Prisma client cleanup complete.');
