import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import express from 'express';
import cors from 'cors';
import mongoose, { CallbackError } from 'mongoose';

import GameModel from './models/game';

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

if (process.env.DATABASE_URL) {
  mongoose.connect(process.env.DATABASE_URL, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
  });
}

const db = mongoose.connection;
db.on('error', (error) => console.error(error));
db.once('open', () => console.log('Connected to DB'));

const httpServer = createServer();
const io = new Server(httpServer);

io.on('connection', (socket: Socket) => {
  console.log(socket.id);

  socket.on('createGame', async (user, callback) => {
    // сгенерировать id игры
    // создать игру с диллером = user
    // вернуть объект игры

    console.log(user);

    const newGame = new GameModel({
      hash: socket.id,
      users: [
        {
          ...user,
        },
      ],
    });
    console.log(newGame);

    await newGame.save((error: CallbackError, game: typeof GameModel) => {
      if (error) {
        console.log(error);
      } else {
        socket.join('room');
        console.log(game);
        callback(game);
      }
    });
  });

  socket.on('loginGame', async (hash, user, callback) => {
    // войти в игру
    // добавить игрока user
    // вернуть объект игры

    await GameModel.findOne({ hash }).exec((error: CallbackError, game: any) => {
      if (error) {
        console.log(error);
      } else {
        socket.join('room');
        console.log(game);
        socket.to(game.hash).emit('loginNewUser', 'Вошел новый юзер');
        callback(game);
      }
    });
  });

  socket.on('closeGame', () => {
    // закрыть игру
    console.log('closeGame', socket.id);
    socket.emit('closeGameServer', 'Игра закрылась');
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected', socket.id);
    socket.in('room').emit('closeGameServer', 'Игра закрылась');
    await GameModel.findOneAndDelete({ hash: socket.id }).exec(
      (error: CallbackError, game: any) => {
        if (error) {
          console.log(error);
        } else {
          console.log(game);
          socket.in('room').emit('closeGameServer', 'Игра закрылась');
        }
      },
    );
  });
});

app.get('/', (req, res) => {
  res.send('Server is up and running');
});

httpServer.listen(PORT, () => {
  console.log(`Listening to ${PORT}`);
});
