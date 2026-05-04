import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_DIST = path.join(__dirname, '../../extension/dist');
const OUTPUT_ZIP = path.join(__dirname, '../public/extension.zip');

async function zipExtension() {
  if (!fs.existsSync(EXTENSION_DIST)) {
    console.error(`Error: Extension build directory not found at ${EXTENSION_DIST}`);
    console.error('Please run "npm run build" in the extension directory first.');
    process.exit(1);
  }

  // Ensure public directory exists
  const publicDir = path.dirname(OUTPUT_ZIP);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const output = fs.createWriteStream(OUTPUT_ZIP);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', function() {
    console.log(archive.pointer() + ' total bytes');
    console.log('Extension zipped successfully to ' + OUTPUT_ZIP);
  });

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.warn('Warning:', err);
    } else {
      throw err;
    }
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  // Append files from a sub-directory, putting its contents at the root of archive
  archive.directory(EXTENSION_DIST, false);

  await archive.finalize();
}

zipExtension();
