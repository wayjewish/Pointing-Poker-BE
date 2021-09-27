/* eslint-disable @typescript-eslint/no-explicit-any */
import { CallbackError } from 'mongoose';
import { Server, Socket } from 'socket.io';
import SessionModel from '../models/session';
import { setCards } from '../assets/setCards';

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
            callback('запрос на вход');
          } else {
            session.users.push(user);
            session.save((error: CallbackError, session: any) => {
              if (!error) {
                socket.join('room');
                io.in('room').emit('update', session);
                callback('вошел');
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
                io.in(user.socket).socketsJoin('room');
                socket.to(user.socket).emit('loginAnswer', 'разрешено войти');
                io.in('room').emit('update', session);
              }
            });
          }
        },
      );
    });

    socket.on('loginDeny', (user) => {
      socket.to(user.socket).emit('loginAnswer', 'во входе отказано');
    });

    socket.on('kick', async (userSocket) => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              if (session) {
                session.users = session.users.filter((user: any) => user.socket !== userSocket);
                session.save((error: CallbackError, session: any) => {
                  if (!error) {
                    io.in(userSocket).socketsLeave('room');
                    socket.to(userSocket).emit('kick');

                    io.in('room').emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('update', async (props) => {
      if (socket.data.role === 'dealer') {
        if (props.settings) {
          props.cards = setCards[props.settings.setCards];
        }

        await SessionModel.findOneAndUpdate(
          { hash: socket.data.hash },
          { $set: props },
          { new: true },
        ).exec((error: CallbackError, session: any) => {
          if (!error) {
            io.in('room').emit('update', session);
          }
        });
      }
    });

    socket.on('settingsChange', async (props) => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              if (props.setCards) {
                session.cards = setCards[props.setCards];
              }

              session.settings = {
                ...session.settings,
                ...props,
              };

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

    socket.on('cardsChange', async (cards) => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              session.cards = cards;
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

    socket.on('runGame', async () => {
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
            if (!error && session) {
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
              session.game.endRound = false;
              session.issues[session.game.issue].cards = [];
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

    socket.on('endRound', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              clearInterval(socket.data.timer);
              session.game.runRound = false;
              session.game.endRound = true;

              const players = session.users.filter((user: any) =>
                user.role === session.settings.masterPlayer ? 'dealer' || 'player' : 'player',
              );

              const { cards } = session.issues[session.game.issue];
              if (cards.length !== players.length) {
                players.forEach((player: any) => {
                  const check = cards.find((card: any) => card.userId === player.socket);
                  if (!check) {
                    cards.push({
                      userId: player.socket,
                      cardValue: 'Unknown',
                    });
                  }
                });
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

    socket.on('endGame', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: any) => {
            if (!error) {
              clearInterval(socket.data.timer);
              session.game.runGame = false;
              session.game.endGame = true;
              session.game.runRound = false;
              session.game.endRound = false;

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

    socket.on('cardSelection', async (value) => {
      await SessionModel.findOne({ hash: socket.data.hash }).exec(
        async (error: CallbackError, session: any) => {
          if (!error) {
            const { cards } = session.issues[session.game.issue];
            const checkIndex = cards.findIndex(
              (card: { userId: string; cardValue: string }) => card.userId === socket.id,
            );
            if (checkIndex !== -1) cards.splice(checkIndex, 1);

            cards.push({
              userId: socket.id,
              cardValue: value,
            });
            session.issues[session.game.issue].cards = cards;

            if (session.settings.flipCards) {
              const players = session.users.filter((user: any) =>
                user.role === session.settings.masterPlayer ? 'dealer' || 'player' : 'player',
              );

              if (cards.length === players.length) {
                const sockets = await io.in('room').fetchSockets();
                clearInterval(sockets[0].data.timer);
                session.game.runRound = false;
                session.game.endRound = true;
              }
            }

            session.save((error: CallbackError, session: any) => {
              if (error) {
                console.log(error);
              }
              if (!error) {
                io.in('room').emit('update', session);
              }
            });
          }
        },
      );
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
