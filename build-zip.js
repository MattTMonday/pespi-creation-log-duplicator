import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run the build command
console.log('Building project...');
execSync('npm run build', { stdio: 'inherit' });

// Create a file to stream archive data to
const output = fs.createWriteStream(path.join(__dirname, 'build.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log('Archive created successfully. Total bytes: ' + archive.pointer());
});

// Good practice to catch warnings
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

// Good practice to catch this error explicitly
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Append files from the dist directory
archive.directory(path.join(__dirname, 'dist'), 'build');

// Finalize the archive
archive.finalize(); 