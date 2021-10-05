import mongoose, { Schema, Document } from 'mongoose';
import { setCards } from '../assets/setCards';

export interface IUser {
  firstName: string;
  lastName?: string;
  job?: string;
  role?: 'dealer' | 'player' | 'spectator';
  avatar?: string;
  socket: string;
}

export interface ISettings {
  masterPlayer: boolean;
  setCards: string;
  autoLogin: boolean;
  flipCards: boolean;
  changingCard: boolean;
  timer: boolean;
  roundTime: number;
  scoreType: string;
  scoreTypeShort: string;
}

export interface IIssueCards {
  userSocket: string;
  cardValue: string;
}

export interface IIssue {
  title: string;
  link: string;
  priority: 'low' | 'middle' | 'hight';
  cards: IIssueCards[];
}

export interface IGame {
  runGame: boolean;
  endGame: boolean;
  runRound: boolean;
  endRound: boolean;
  time: number;
  issue: number;
}

export interface IVoitesVotes {
  userSocket: string;
  voteType: string;
}

export interface IVoites {
  run: boolean;
  whoSocket: string;
  whomSocket: string;
  votes: IVoitesVotes[];
}

export interface IMsgToChat {
  user: IUser;
  message: string;
}

export interface ISession extends Document {
  title: string;
  hash: string;
  users: IUser[];
  settings: ISettings;
  cards: string[];
  issues: IIssue[];
  game: IGame;
  voting: IVoites;
  chat: IMsgToChat[];
}

const sessionSchema: Schema = new Schema(
  {
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
      }, // можно ли менять свой выбор после того как все карты уже перевернуты
      timer: { type: Boolean, default: true }, // нужен ли таймер
      roundTime: { type: Number, default: 140 }, // время таймера
      scoreType: { type: String, default: 'story point' },
      scoreTypeShort: { type: String, default: 'SP' },
    },
    cards: {
      type: Array,
      default: setCards.fibonacci,
    },
    issues: [
      {
        title: String,
        link: String,
        priority: ['low', 'middle', 'hight'],
        cards: [
          {
            userSocket: String,
            cardValue: String,
          },
        ],
      },
    ],
    game: {
      runGame: {
        type: Boolean,
        default: false,
      },
      endGame: {
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
      time: {
        type: Number,
        default: 0,
      },
      issue: {
        type: Number,
        default: 0,
      },
    },
    voting: {
      run: {
        type: Boolean,
        default: false,
      },
      whoSocket: String,
      whomSocket: String,
      votes: [
        {
          userSocket: String,
          voteType: String,
        },
      ],
    },
    chat: [
      {
        user: {
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
        message: String,
      },
    ],
  },
  { minimize: false },
);

export default mongoose.model<ISession>('Session', sessionSchema);
