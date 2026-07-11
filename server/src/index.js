import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

import dictRoutes from './routes/dict.js';
import printRoutes from './routes/print.js';
import historyRoutes from './routes/history.js';
import statsRoutes from './routes/stats.js';
import voiceRoutes from './routes/voice.js';
import aiSettingsRoutes from './routes/aiSettings.js';
import passwordRoutes from './routes/password.js';
import { setupSocket } from './socket.js';

export const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);
export const io = new SocketIO(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 路由
app.use('/api/dict', dictRoutes);
app.use('/api/print', printRoutes);
app.use('/api/print', historyRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/ai-settings', aiSettingsRoutes);
app.use('/api/password', passwordRoutes);

// 健康检查
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// 生产模式：提供前端静态文件 + SPA fallback
const publicDir = join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(join(publicDir, 'index.html'));
});

// Socket.io
setupSocket(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
