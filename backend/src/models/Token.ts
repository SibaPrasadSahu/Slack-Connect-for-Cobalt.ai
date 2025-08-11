import mongoose from 'mongoose';

const Schema = new mongoose.Schema({
  teamId: {type: String, index: true, unique: true},
  accessToken: String,
  refreshToken: String,
  tokenType: String,
  scope: String,
  expiresAt: Number
}, {timestamps:true});

export default mongoose.model('Token', Schema);
