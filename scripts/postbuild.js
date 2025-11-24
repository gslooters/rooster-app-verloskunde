const fs = require('fs');
const path = require('path');

/**
 * 📦 POST-BUILD SCRIPT voor Next.js Standalone Mode op Railway
 * 
 * KRITIEKE FUNCTIE:
 * Next.js standalone mode creëert een geoptimaliseerde server bundle,
 * maar kopieert NIET automatisch:
 * 1. .next/static (CSS, JS, images)
 * 2. public/ folder (static assets)
 * 
 * Deze script kopieert deze folders naar de standalone build directory,
 * zodat de productie server ze kan serveren.
 * 
 * ZONDER deze script:
 * - CSS/JS fails to load (404 errors)
 * - Images/fonts missing
 * - App render zonder styling
 */

console.log('📦 [POSTBUILD] Starting post-build copy operations...');
console.log(`📋 [POSTBUILD] Node version: ${process.version}`);
console.log(`📋 [POSTBUILD] Working directory: ${process.cwd()}`);

// 🔑 Functie om recursief directories te kopiëren
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  
  if (!exists) {
    console.warn(`⚠️  [POSTBUILD] Source not found: ${src}`);
    return false;
  }
  
  const stats = fs.statSync(src);
  const isDirectory = stats.isDirectory();

  if (isDirectory) {
    // Maak destination directory aan als die niet bestaat
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
      console.log(`✅ [POSTBUILD] Created directory: ${dest}`);
    }
    
    // Kopieer alle bestanden in de directory
    const files = fs.readdirSync(src);
    files.forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Kopieer individueel bestand
    try {
      fs.copyFileSync(src, dest);
      console.log(`  ✓ Copied: ${path.basename(src)}`);
    } catch (error) {
      console.error(`  ✗ Failed to copy ${src}:`, error.message);
    }
  }
  
  return true;
}

try {
  // 📋 Verifieer dat .next/standalone bestaat
  const standalonePath = path.join(process.cwd(), '.next', 'standalone');
  if (!fs.existsSync(standalonePath)) {
    throw new Error(
      '.next/standalone directory not found! ' +
      'Ensure next.config.js has output: "standalone"'
    );
  }
  console.log(`✅ [POSTBUILD] Standalone directory verified: ${standalonePath}`);

  // 1️⃣ Kopieer .next/static naar .next/standalone/.next/static
  const staticSource = path.join(process.cwd(), '.next', 'static');
  const staticDest = path.join(standalonePath, '.next', 'static');
  
  console.log('');
  console.log('📁 [POSTBUILD] Copying .next/static to standalone...');
  console.log(`   Source: ${staticSource}`);
  console.log(`   Dest:   ${staticDest}`);
  
  if (copyRecursiveSync(staticSource, staticDest)) {
    console.log('✅ [POSTBUILD] Static files copied successfully');
  } else {
    console.warn('⚠️  [POSTBUILD] Static files copy skipped (source not found)');
  }

  // 2️⃣ Kopieer public naar .next/standalone/public
  const publicSource = path.join(process.cwd(), 'public');
  const publicDest = path.join(standalonePath, 'public');
  
  console.log('');
  console.log('📁 [POSTBUILD] Copying public folder to standalone...');
  console.log(`   Source: ${publicSource}`);
  console.log(`   Dest:   ${publicDest}`);
  
  if (copyRecursiveSync(publicSource, publicDest)) {
    console.log('✅ [POSTBUILD] Public files copied successfully');
  } else {
    console.warn('⚠️  [POSTBUILD] Public files copy skipped (source not found)');
  }

  // 3️⃣ Verifieer dat server.js bestaat
  const serverPath = path.join(standalonePath, 'server.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error(
      'server.js not found in standalone build! ' +
      'Next.js build may have failed.'
    );
  }
  console.log(`✅ [POSTBUILD] Server.js verified: ${serverPath}`);

  console.log('');
  console.log('🎉 [POSTBUILD] Post-build operations completed successfully!');
  console.log('');
  console.log('🚀 Standalone build is ready for Railway deployment:');
  console.log(`   📂 Location: ${standalonePath}`);
  console.log('   🚀 Start command: node .next/standalone/server.js');
  console.log('   🌍 HOSTNAME: Bind to 0.0.0.0 (Railway requirement)');
  console.log('');
  
  // Exit met success
  process.exit(0);

} catch (error) {
  console.error('');
  console.error('❌ [POSTBUILD] FATAL ERROR during post-build operations:');
  console.error(`   ${error.message}`);
  console.error('');
  console.error('Stack trace:');
  console.error(error.stack);
  console.error('');
  
  // Exit met error code
  process.exit(1);
}
