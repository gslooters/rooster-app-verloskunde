const fs = require('fs');
const path = require('path');

/**
 * Post-build script voor Next.js standalone mode
 * Kopieert static assets en public folder naar standalone build
 * Noodzakelijk voor Railway deployment met standalone output
 */

console.log('📦 Starting post-build copy operations...');

// Functie om recursief directories te kopiëren
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    // Maak destination directory aan als die niet bestaat
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    // Kopieer alle bestanden in de directory
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Kopieer individueel bestand
    fs.copyFileSync(src, dest);
  }
}

try {
  // 1. Kopieer .next/static naar .next/standalone/.next/static
  const staticSource = path.join(process.cwd(), '.next', 'static');
  const staticDest = path.join(process.cwd(), '.next', 'standalone', '.next', 'static');
  
  if (fs.existsSync(staticSource)) {
    console.log('📁 Copying .next/static to standalone...');
    copyRecursiveSync(staticSource, staticDest);
    console.log('✅ Static files copied successfully');
  } else {
    console.warn('⚠️  .next/static not found, skipping...');
  }

  // 2. Kopieer public naar .next/standalone/public
  const publicSource = path.join(process.cwd(), 'public');
  const publicDest = path.join(process.cwd(), '.next', 'standalone', 'public');
  
  if (fs.existsSync(publicSource)) {
    console.log('📁 Copying public folder to standalone...');
    copyRecursiveSync(publicSource, publicDest);
    console.log('✅ Public files copied successfully');
  } else {
    console.warn('⚠️  public folder not found, skipping...');
  }

  console.log('🎉 Post-build operations completed successfully!');
  console.log('');
  console.log('Standalone build is ready for deployment:');
  console.log('  📂 Location: .next/standalone/');
  console.log('  🚀 Start command: node .next/standalone/server.js');
  console.log('');

} catch (error) {
  console.error('❌ Error during post-build operations:', error);
  process.exit(1);
}
