import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduledMessage extends Document {
  teamId: string;
  channelId: string;
  text: string;
  sendAt: Date;
  status: 'scheduled' | 'sending' | 'retry' | 'sent' | 'cancelled';
  retryCount?: number;
  sentAt?: Date;

  
  slackTs?: string;         
  permalink?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const ScheduledMessageSchema = new Schema<IScheduledMessage>({
  teamId: { type: String, required: true },
  channelId: { type: String, required: true },
  text: { type: String, required: true },
  sendAt: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'sending', 'retry', 'sent', 'cancelled'], default: 'scheduled' },
  retryCount: { type: Number, default: 0 },
  sentAt: { type: Date },

  // NEW
  slackTs: { type: String },
  permalink: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model<IScheduledMessage>('ScheduledMessage', ScheduledMessageSchema);