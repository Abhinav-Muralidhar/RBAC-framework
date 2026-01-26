// backend/src/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Standard Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Basic Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    message: 'RBAC Backend is running',
    environment: process.env.NODE_VERSION || 'development'
  });
});

app.listen(PORT, () => {
  console.log(`-----------------------------------------`);
  console.log(`🚀 Server is breathing at: http://localhost:${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`-----------------------------------------`);
});