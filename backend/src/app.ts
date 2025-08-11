import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';            
import authRouter from './routes/auth';
import slackRouter from './routes/slack';
import scheduler from './services/scheduler';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { attachSession } from './middleware/session';  
dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,                                   
}));

app.use(cookieParser());                               
app.use(bodyParser.json());
app.use(attachSession);                               
app.use('/api/auth', authRouter);
app.use('/api/slack', slackRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

scheduler.start();

export default app;
