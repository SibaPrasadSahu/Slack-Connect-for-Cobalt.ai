import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function start() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/slack_scheduler';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
