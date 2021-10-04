import * as dotenv from 'dotenv';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import './db/db';
import socker from './socker/socker';

dotenv.config();
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer();
socker(server);

/*
app.get('/', (req, res) => {
  res.send('Server is up and running');
});

app.listen(process.env.PORT_API, () => {
  console.log(`Api listening on port ${process.env.PORT_API}!`);
});
*/

server.listen(PORT, () => {
  console.log(`Listening to ${PORT}`);
});
