import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.join(__dirname, '../web-app/out');
const DEST_DIR = path.join(__dirname, '../out');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(DEST_DIR)) {
    fs.rmSync(DEST_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(SOURCE_DIR)) {
    copyRecursiveSync(SOURCE_DIR, DEST_DIR);
    console.log(`Successfully copied ${SOURCE_DIR} to ${DEST_DIR}`);
  } else {
    console.error(`Source directory ${SOURCE_DIR} does not exist`);
    process.exit(1);
  }
} catch (err) {
  console.error("Error copying directory:", err);
  process.exit(1);
}
