import { CallbackError } from 'mongoose';
import { Socket } from 'socket.io';
import SessionModel from '../models/session';

export function timer(socket: Socket, time: number) {
  async function step() {
    if (time < 1) {
      clearInterval(socket.data.timer);
    } else {
      const newSession = {
        game: {
          time: time--,
        },
      };
      await SessionModel.findOneAndUpdate({ hash: socket.id }, newSession, { new: true }).exec(
        (error: CallbackError, session: any) => {
          if (!error) {
            io.in('room').emit('update', session);
          }
        },
      );
    }
  }

  setInterval(step, 1000);
}
