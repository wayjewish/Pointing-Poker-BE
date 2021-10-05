import * as http from 'http';
import { CallbackError } from 'mongoose';
import { Server, Socket } from 'socket.io';
import SessionModel, {
  ISession,
  IUser,
  IIssueCards,
  IVoitesVotes,
  ISettings,
} from '../models/session';
import { setCards } from '../assets/setCards';

const socker: (server: http.Server) => void = (server) => {
  const io = new Server(server);

  io.on('connection', (socket: Socket) => {
    console.log(socket.id);

    socket.on('create', async (user: IUser, callback: (msg: any) => void) => {
      const newSession = new SessionModel({
        hash: socket.id,
        users: [
          {
            ...user,
          },
        ],
      });

      await newSession.save((error: CallbackError, session: ISession) => {
        if (error) {
          callback(error);
        } else {
          socket.data.hash = socket.id;
          socket.data.role = user.role;
          socket.data.room = `room${socket.id}`;

          socket.join(socket.data.room);
          callback(session);
        }
      });
    });

    socket.on('check', async (hash: string, callback) => {
      await SessionModel.findOne({ hash }).exec(
        (error: CallbackError, session: ISession | null) => {
          if (error) {
            callback(error);
          } else if (session) {
            callback(true);
          } else {
            callback(false);
          }
        },
      );
    });

    socket.on('login', async (hash: string, user: IUser, callback: (msg: any) => void) => {
      await SessionModel.findOne({ hash }).exec(
        (error: CallbackError, session: ISession | null) => {
          if (error) {
            callback(error);
          } else if (session) {
            socket.data.hash = hash;
            socket.data.role = user.role;
            socket.data.room = `room${hash}`;

            if (session.game.runGame && !session.settings.autoLogin) {
              socket.to(session.hash).emit('loginRequest', user);
              callback('запрос на вход');
            } else {
              session.users.push(user);
              session.save((error: CallbackError, session: ISession | null) => {
                if (!error) {
                  socket.join(socket.data.room);
                  io.in(socket.data.room).emit('update', session);
                  callback('вошел');
                }
              });
            }
          } else {
            callback('нет такой сессии');
          }
        },
      );
    });

    socket.on('exit', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOneAndDelete({ hash: socket.data.hash }).exec(
          (error: CallbackError) => {
            if (!error) {
              io.in(socket.data.room).emit('close', 'сессия закрылась');
              io.in(socket.data.room).socketsLeave(socket.data.room);
            }
          },
        );
      } else {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                session.users = session.users.filter((user: IUser) => user.socket !== socket.id);
                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    socket.leave(socket.data.room);
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('loginAllow', async (user: IUser) => {
      await SessionModel.findOne({ hash: socket.data.hash }).exec(
        (error: CallbackError, session: ISession | null) => {
          if (!error) {
            if (session) {
              session.users.push(user);
              session.save((error: CallbackError, session: ISession | null) => {
                if (!error) {
                  io.in(user.socket).socketsJoin(socket.data.room);
                  socket.to(user.socket).emit('loginAnswer', 'разрешено войти');
                  io.in(socket.data.room).emit('update', session);
                }
              });
            }
          }
        },
      );
    });

    socket.on('loginDeny', (user: IUser) => {
      socket.to(user.socket).emit('loginAnswer', 'во входе отказано');
    });

    socket.on('kick', async (userSocket: string) => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                session.users = session.users.filter((user: IUser) => user.socket !== userSocket);
                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(userSocket).socketsLeave(socket.data.room);
                    socket.to(userSocket).emit('kick');
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('votingStart', async (whoSocket: string, whomSocket: string) => {
      if (socket.data.role === 'player') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                session.voting = {
                  run: true,
                  whoSocket,
                  whomSocket,
                  votes: [],
                };
                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('vote', async (type: 'yes' | 'no') => {
      await SessionModel.findOne({ hash: socket.data.hash }).exec(
        (error: CallbackError, session: ISession | null) => {
          if (!error) {
            if (session) {
              session.voting.votes.push({
                userSocket: socket.id,
                voteType: type,
              });

              const yesVotes = session.voting.votes.filter(
                (vote: IVoitesVotes) => vote.voteType === 'yes',
              );
              const players = session.users.filter(
                (user: IUser) =>
                  user.role === 'player' &&
                  user.socket !== session.voting.whoSocket &&
                  user.socket !== session.voting.whomSocket,
              );
              const checkCountVotes = Math.floor(players.length / 2) + 1;

              if (session.voting.votes.length === players.length) {
                if (yesVotes.length >= checkCountVotes) {
                  io.in(session.voting.whomSocket).socketsLeave(socket.data.room);
                  socket.to(session.voting.whomSocket).emit('kick');

                  session.users = session.users.filter(
                    (user: IUser) => user.socket !== session.voting.whomSocket,
                  );
                }

                session.voting = {
                  run: false,
                  whoSocket: '',
                  whomSocket: '',
                  votes: [],
                };
              }

              session.save((error: CallbackError, session: ISession | null) => {
                if (!error) {
                  io.in(socket.data.room).emit('update', session);
                }
              });
            }
          }
        },
      );
    });

    socket.on('addMsgToChat', async (user: IUser, message: string) => {
      await SessionModel.findOne({ hash: socket.data.hash }).exec(
        (error: CallbackError, session: ISession | null) => {
          if (!error) {
            if (session) {
              session.chat.push({
                user,
                message,
              });
              session.save((error: CallbackError, session: ISession | null) => {
                if (!error) {
                  io.in(socket.data.room).emit('update', session);
                }
              });
            }
          }
        },
      );
    });

    socket.on('update', async (props: ISession) => {
      if (socket.data.role === 'dealer') {
        if (props.settings) {
          props.cards = setCards[props.settings.setCards];
        }

        await SessionModel.findOneAndUpdate(
          { hash: socket.data.hash },
          { $set: props },
          { new: true },
        ).exec((error: CallbackError, session: ISession | null) => {
          if (!error) {
            io.in(socket.data.room).emit('update', session);
          }
        });
      }
    });

    socket.on('settingsChange', async (props: ISettings) => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                if (props.setCards) {
                  session.cards = setCards[props.setCards];
                }

                session.settings = {
                  ...session.settings,
                  ...props,
                };

                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('cardsChange', async (cards: string[]) => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                session.cards = cards;
                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('runGame', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                session.game.runGame = true;
                if (session.settings.timer) {
                  session.game.time = session.settings.roundTime;
                }
                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    function timer(time: number) {
      async function step() {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error && session) {
              time--;
              session.game.time = time;

              if (time < 1) {
                clearInterval(socket.data.timer);
                session.game.runRound = false;
                session.game.endRound = true;
              }

              session.save((error: CallbackError, session: ISession | null) => {
                if (!error) {
                  io.in(socket.data.room).emit('update', session);
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
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                session.game.runRound = true;
                session.game.endRound = false;
                session.issues[session.game.issue].cards = [];
                if (session.settings.timer) {
                  timer(session.game.time);
                }
                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('newRound', async (key) => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                session.game.issue = key;
                session.game.runRound = false;
                session.game.endRound = false;
                if (session.settings.timer) {
                  session.game.time = session.settings.roundTime;
                }
                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('endRound', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                clearInterval(socket.data.timer);
                session.game.runRound = false;
                session.game.endRound = true;

                const players = session.users.filter((user: IUser) =>
                  session.settings.masterPlayer
                    ? user.role === 'dealer' || user.role === 'player'
                    : user.role === 'player',
                );

                const { cards } = session.issues[session.game.issue];
                if (cards.length !== players.length) {
                  players.forEach((player: IUser) => {
                    const check = cards.find(
                      (card: IIssueCards) => card.userSocket === player.socket,
                    );
                    if (!check) {
                      cards.push({
                        userSocket: player.socket,
                        cardValue: 'Unknown',
                      });
                    }
                  });
                }

                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('endGame', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                clearInterval(socket.data.timer);
                session.game.runGame = false;
                session.game.endGame = true;
                session.game.runRound = false;
                session.game.endRound = false;

                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    io.in(socket.data.room).emit('update', session);
                  }
                });
              }
            }
          },
        );
      }
    });

    socket.on('cardSelection', async (value: string) => {
      await SessionModel.findOne({ hash: socket.data.hash }).exec(
        async (error: CallbackError, session: ISession | null) => {
          if (!error) {
            if (session) {
              const { cards } = session.issues[session.game.issue];
              const checkIndex = cards.findIndex(
                (card: IIssueCards) => card.userSocket === socket.id,
              );
              if (checkIndex !== -1) cards.splice(checkIndex, 1);

              cards.push({
                userSocket: socket.id,
                cardValue: value,
              });
              session.issues[session.game.issue].cards = cards;

              if (session.settings.flipCards) {
                const players = session.users.filter((user: IUser) =>
                  session.settings.masterPlayer
                    ? user.role === 'dealer' || user.role === 'player'
                    : user.role === 'player',
                );

                if (cards.length === players.length) {
                  const sockets = await io.in(socket.data.room).fetchSockets();
                  clearInterval(sockets[0].data.timer);
                  session.game.runRound = false;
                  session.game.endRound = true;
                }
              }

              session.save((error: CallbackError, session: ISession | null) => {
                if (!error) {
                  io.in(socket.data.room).emit('update', session);
                }
              });
            }
          }
        },
      );
    });

    socket.on('disconnect', async () => {
      if (socket.data.role === 'dealer') {
        await SessionModel.findOneAndDelete({ hash: socket.data.hash }).exec(
          (error: CallbackError) => {
            if (!error) {
              io.in(socket.data.room).emit('close', 'сессия закрылась');
              io.in(socket.data.room).socketsLeave(socket.data.room);
            }
          },
        );
      } else {
        await SessionModel.findOne({ hash: socket.data.hash }).exec(
          (error: CallbackError, session: ISession | null) => {
            if (!error) {
              if (session) {
                session.users = session.users.filter((user: IUser) => user.socket !== socket.id);
                session.save((error: CallbackError, session: ISession | null) => {
                  if (!error) {
                    socket.leave(socket.data.room);
                    io.in(socket.data.room).emit('update', session);
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
