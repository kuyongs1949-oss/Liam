/**
 * Express 메인 서버
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const calculationsRouter = require('./api/routes/calculations');
const compensationRouter = require('./api/routes/compensation');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Rate limit
app.use(
  '/api',
  rateLimit({ windowMs: 60_000, max: 100, message: '요청 한도 초과' })
);

// 라우터
app.use('/api/calculations', calculationsRouter);
app.use('/api/compensation', compensationRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'noise-assessment-backend',
    timestamp: new Date().toISOString(),
  });
});

// 404 처리
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// 에러 처리
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});

module.exports = app;
