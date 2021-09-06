interface user {
  id: string;
  firstName: string;
  lastNmae: string;
  role: 'dealer' | 'player' | 'spectator';
  avatar: File; // мб base64?
}

interface card {
  value: number; // есть ли у карт что то еще?
}

interface issue {
  name: string;
}

interface game {
  id: string; // hash = урл игры
  users: user[];
  settings: {
    masterPlayer: boolean;
    changingCard: boolean;
    timer: boolean;
    scoreType: string;
    scoreTypeShort: string;
    roundTime: number; // seconds
  };
  cards: card[];
  issues: issue[];
}
