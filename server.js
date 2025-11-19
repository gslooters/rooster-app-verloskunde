#!/usr/bin/env node

/**
 * Custom server.js voor Railway deployment
 * Dit bestand start de Next.js standalone server met de juiste configuratie
 * voor Railway's netwerk omgeving (PORT en hostname binding)
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Railway inject PORT variable - gebruik deze of fallback naar 3000
const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';

// Configureer Next.js app
const app = next({ 
  dev,
  hostname,
  port,
  // Voor standalone deployment
  conf: {
    distDir: '.next'
  }
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Environment: ${process.env.NODE_ENV}`);
    console.log(`> Listening for Railway healthchecks...`);
  });
});
