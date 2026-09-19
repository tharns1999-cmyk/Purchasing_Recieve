import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distHtmlPath = path.join(rootDir, 'dist', 'index.html');
const gasDir = path.join(rootDir, 'gas');
const gasHtmlPath = path.join(gasDir, 'index.html');

try {
  if (!fs.existsSync(gasDir)) {
    fs.mkdirSync(gasDir, { recursive: true });
  }

  if (fs.existsSync(distHtmlPath)) {
    let html = fs.readFileSync(distHtmlPath, 'utf8');
    
    // Inject window.SERVER_INITIAL_DATA script before closing </head>
    const initialDataScript = `\n    <script>window.SERVER_INITIAL_DATA = <?!= typeof initialData !== 'undefined' ? initialData : 'null' ?>;</script>\n  `;
    html = html.replace('</head>', `${initialDataScript}</head>`);
    
    fs.writeFileSync(gasHtmlPath, html);
    console.log('✅ Successfully copied and injected dist/index.html to gas/index.html');
  } else {
    console.error('❌ dist/index.html not found! Please run vite build first.');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Error copying gas/index.html:', err);
  process.exit(1);
}
