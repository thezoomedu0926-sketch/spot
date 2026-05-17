import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  const PORT = 3000;

  // Real-time state (simple version)
  // In a real app, you might want to store more complex data
  let strokes: any[] = [];

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send initial state to new user
    socket.emit('init-state', strokes);

    // Handle new strokes
    socket.on('draw', (stroke) => {
      strokes.push(stroke);
      socket.broadcast.emit('draw', stroke);
    });

    // Handle delete (undo)
    socket.on('delete-stroke', (id) => {
      strokes = strokes.filter(s => s.id !== id);
      io.emit('delete-stroke', id);
    });

    // Handle clear
    socket.on('clear', () => {
      strokes = [];
      io.emit('clear');
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
