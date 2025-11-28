/**
 * 🚀 CUSTOM SERVER BOOTSTRAP VOOR RAILWAY
 * 
 * PROBLEEM:
 * - Next.js standalone server bindt standaard aan localhost
 * - Railway vereist binding aan 0.0.0.0 voor external traffic
 * - HOSTNAME env var wordt niet altijd correct toegepast
 * 
 * OPLOSSING:
 * - Expliciet binden aan 0.0.0.0
 * - Railway PORT env var gebruiken
 * - Fallback naar 3000
 * - Logging voor debugging
 */

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

// 🔥 CRITICAL: Force production mode
const dev = false
const hostname = '0.0.0.0'  // Railway requirement
const port = parseInt(process.env.PORT || '3000', 10)

// ✅ Logging voor Railway dashboard
console.log('🚀 Starting Rooster App server...')
console.log(`   🌐 Hostname: ${hostname}`)
console.log(`   🔌 Port: ${port}`)
console.log(`   📦 Mode: ${dev ? 'development' : 'production'}`)
console.log(`   📂 Working directory: ${process.cwd()}`)

// Initialize Next.js app
const app = next({ 
  dev, 
  hostname, 
  port,
  // 🔥 Use standalone output
  dir: process.cwd()
})

const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('❌ Error handling request:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }).listen(port, hostname, (err) => {
    if (err) {
      console.error('❌ Server failed to start:', err)
      throw err
    }
    console.log(`✅ Server ready on http://${hostname}:${port}`)
    console.log(`🎉 Rooster App is live!`)
  })
})
