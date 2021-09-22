import { CallbackError } from 'mongoose';
import { Server, Socket } from 'socket.io';
import SessionModel from '../models/session';

const socker = (server: any) => {
  const io = new Server(server);

  io.on('connection', (socket: Socket) => {
    console.log(socket.id);

    socket.on('create', async (user, callback) => {
      const newSession = new SessionModel({
        hash: socket.id,
        users: [
          {
            ...user,
          },
        ],
      });

      await newSession.save((error: CallbackError, session: typeof SessionModel) => {
        if (error) {
          callback(error);
        } else {
          socket.data.hash = socket.id;
          socket.data.role = user.role;

          socket.join('room');
          callback(session);
        }
      });
    });

    socket.on('check', async (hash, callback) => {
      await SessionModel.findOne({ hash }).exec((error: CallbackError, session: any) => {
        if (error) {
          callback(error);
        } else if (session) {
          callback(true);
        } else {
          callback(false);
        }
      });
    });

    socket.on('login', async (hash, user, callback) => {
      await SessionModel.findOne({ hash }).exec((error: CallbackError, session: any) => {
        if (error) {
          callback(error);
        } else if (session) {
          socket.data.hash = hash;
          socket.data.role = user.role;

          if (session.game.runGame && !session.settings.autoLogin) {
            socket.to(session.hash).emit('loginRequest', hash, user, socket.id);
            callback({
              msg: 'запрос на вход',
            });
          } else {
            session.users.push(user);
            session.save((error: CallbackError, session: any) => {
              if (!error) {
                io.in('room').emit('update', session);
                socket.join('room');
                callback({
                  msg: 'вошел',
                  session,
                });
              }
            });
          }
        } else {
          callback('нет такой сессии');
        }
      });
    });

    socket.on('loginAllow', async (hash, user) => {
      await SessionModel.findOne({ hash }).exec((error: CallbackError, session: any) => {
        if (!error) {
          session.users.push(user);
          session.save((error: CallbackError, session: any) => {
            if (!error) {
              socket.to(user.socket).emit('loginAnswer', {
                msg: 'разрешено войти',
                session,
              });
              io.in('room').emit('update', session);
            }
          });
        }
      });
    });

    socket.on('loginDeny', (hash, user) => {
      socket.to(user.socket).emit('loginAnswer', {
        msg: 'во входе отказано',
      });
    });

    socket.on('joinRoom', () => {
      socket.join('room');
    });

    socket.on('update', async (newSession) => {
      await SessionModel.findOneAndUpdate({ hash: newSession.hash }, newSession, {
        new: true,
      }).exec((error: CallbackError, session: any) => {
        if (!error) {
          io.in('room').emit('update', session);
        }
      });
    });

    socket.on('disconnect', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOneAndDelete({ hash: socket.id }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              io.in('room').emit('close', 'сессия закрылась');
            }
          },
        );
      } else {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              if (session) {
                session.users = session.users.filter((user: any) => user.socket !== socket.id);
                session.save((error: CallbackError, session: any) => {
                  if (!error) {
                    io.in('room').emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });
  });

  return io;
};

export default socker;
