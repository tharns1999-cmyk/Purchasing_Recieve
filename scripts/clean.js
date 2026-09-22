import fs from 'fs';
import path from 'path';

const dirsToClean = ['dist', 'node_modules/.vite'];
for (const dir of dirsToClean) {
  const fullPath = path.resolve(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`[Clean] Cleared cache folder: ${dir}`);
  }
}
