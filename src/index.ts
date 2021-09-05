import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import express from 'express';
import cors from 'cors';

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer();
const io = new Server(httpServer);

io.on('connection', (socket: Socket) => {
  console.log(socket.id);

  socket.on('createGame', (user) => {
    // сгенерировать id игры
    // создать игру с диллером = user
    // вернуть объект игры
  });

  socket.on('loginGame', (user) => {
    // войти в игру
    // добавить игрока user
    // вернуть объект игры
  });

  socket.on('closeGame', () => {
    // закрыть игру
  });
});

app.get('/', (req, res) => {
  res.send('Server is up and running');
});

httpServer.listen(PORT, () => {
  console.log(`Listening to ${PORT}`);
});
