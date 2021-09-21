import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

if (process.env.DATABASE_URL) {
  mongoose.connect(process.env.DATABASE_URL, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
  });
}

const db = mongoose.connection;

db.on('connected', () => console.log('Connected to DB'));
db.on('error', (error) => console.error(error));
db.on('disconnected', () => console.log('Disconnected DB'));

export default mongoose;
