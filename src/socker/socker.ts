/* eslint-disable @typescript-eslint/no-explicit-any */
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
            socket.to(session.hash).emit('loginRequest', user);
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

    socket.on('loginAllow', async (user) => {
      await SessionModel.findOne({ hash: socket.data.hash }).exec(
        (error: CallbackError, session: any) => {
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
        },
      );
    });

    socket.on('loginDeny', (user) => {
      socket.to(user.socket).emit('loginAnswer', {
        msg: 'во входе отказано',
      });
    });

    socket.on('joinRoom', () => {
      socket.join('room');
    });

    socket.on('update', async (props) => {
      await SessionModel.findOneAndUpdate(
        { hash: socket.data.hash },
        { $set: props },
        { new: true },
      ).exec((error: CallbackError, session: any) => {
        if (!error) {
          io.in('room').emit('update', session);
        }
      });
    });

    socket.on('startGame', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              session.game.runGame = true;
              if (session.settings.timer) {
                session.game.time = session.settings.roundTime;
              }
              session.save((error: CallbackError, session: any) => {
                if (!error) {
                  io.in('room').emit('update', session);
                }
              });
            }
          },
        );
      }
    });

    function timer(time: number) {
      async function step() {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              time--;
              session.game.time = time;

              if (time < 1) {
                clearInterval(socket.data.timer);
                session.game.runRound = false;
                session.game.endRound = true;
              }

              session.save((error: CallbackError, session: any) => {
                if (!error) {
                  io.in('room').emit('update', session);
                }
              });
            }
          },
        );
      }

      socket.data.timer = setInterval(step, 1000);
    }

    socket.on('runRound', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              session.game.runRound = true;
              if (session.settings.timer) {
                timer(session.game.time);
              }
              session.save((error: CallbackError, session: any) => {
                if (!error) {
                  io.in('room').emit('update', session);
                }
              });
            }
          },
        );
      }
    });

    socket.on('newRound', async (key) => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              session.game.issue = key;
              session.game.runRound = false;
              session.game.endRound = false;
              if (session.settings.timer) {
                session.game.time = session.settings.roundTime;
              }
              session.save((error: CallbackError, session: any) => {
                if (!error) {
                  io.in('room').emit('update', session);
                }
              });
            }
          },
        );
      }
    });

    socket.on('disconnect', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOneAndDelete({ hash: socket.data.hash }).exec(
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
