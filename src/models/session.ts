import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Sprint',
  },
  hash: { type: String, required: true },
  users: [
    {
      firstName: { type: String, required: true },
      lastName: String,
      job: String,
      role: {
        type: String,
        required: true,
        enum: ['dealer', 'player', 'spectator'],
      },
      avatar: String,
      socket: {
        type: String,
        required: true,
      },
    },
  ],
  settings: {
    masterPlayer: {
      type: Boolean,
      default: true,
    }, // будет ли дилер принимать участие в игре
    setCards: {
      type: String,
      enum: ['fibonacci', 'degreesTwo', 'custom'],
      default: 'fibonacci',
    }, // какой набор карточек будет использоваться
    autoLogin: {
      type: Boolean,
      default: false,
    }, // впускать автоматически всех новых участников, если игра уже началась
    flipCards: {
      type: Boolean,
      default: false,
    }, // будут ли карты переворачиваться автоматически как только все проголосуют
    changingCard: {
      type: Boolean,
      default: false,
    }, // переворачивать карты как только все проголосуют
    timer: { type: Boolean, default: true }, // нужен ли таймер
    roundTime: { type: Number, default: 140 }, // время таймера
    scoreType: { type: String, default: 'story point' },
    scoreTypeShort: { type: String, default: 'SP' },
  },
  cards: {
    type: Array,
    default: ['Unknown', '0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89'],
  },
  issues: [
    {
      title: String,
      link: String,
      priority: ['low', 'middle', 'hight'],
      cards: {
        userId: String, // value card
      },
    },
  ],
  game: {
    runGame: {
      type: Boolean,
      default: false,
    },
    runRound: {
      type: Boolean,
      default: false,
    },
    endRound: {
      type: Boolean,
      default: false,
    },
    timer: {
      type: Number,
      default: 0,
    },
    issue: {
      type: Number,
      default: 0,
    },
  },
});

export default mongoose.model('Session', sessionSchema);
