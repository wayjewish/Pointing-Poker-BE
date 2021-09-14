import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Sprint',
  },
  hash: String,
  users: [
    {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      job: String,
      role: {
        type: String,
        required: true,
        enum: ['dealer', 'player', 'spectator'],
      },
      socket: String,
    },
  ],
  settings: {
    masterPlayer: { type: Boolean, default: true },
    changingCard: { type: Boolean, default: false },
    timer: { type: Boolean, default: true },
    scoreType: { type: String, default: 'story point' },
    scoreTypeShort: { type: String, default: 'SP' },
    roundTime: { type: String, default: 140 },
  },
  cards: [
    {
      value: { type: Number, required: true },
    },
  ],
  issues: [
    {
      name: { type: String, required: true },
    },
  ],
});

export default mongoose.model('Session', sessionSchema);
