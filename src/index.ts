import 'dotenv/config';
import http from 'http';
import { webhooksController } from './controllers/webhooks.controller';

let currentPort = Number(process.env.PORT) || 3000;

// Simple Node.js HTTP server. Ready to deploy to Render / Heroku / AWS.
const server = http.createServer(async (req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} accessed.`);
  
  if (req.method === 'POST') {
    if (req.url === '/webhooks/publish-gumroad') {
      return webhooksController.handlePublishGumroad(req, res);
    } 
    if (req.url === '/webhooks/unpublish-gumroad') {
      return webhooksController.handleUnpublishGumroad(req, res);
    }
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

function startServer(port: number) {
  server.listen(port, () => {
    console.log(`Gumroad Webhook Orchestrator listening on port ${port}`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      server.close();
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(currentPort);
