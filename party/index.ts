import type * as Party from "partykit/server";

interface PlayerData {
  stats?: Record<string, unknown>;
  imgSrc?: string;
  move?: string;
  feintDeclared?: string | null;
  playerIndex: number;
}

export default class RakugakiRoom implements Party.Server {
  playerData = new Map<string, PlayerData>();
  playerOrder: string[] = [];

  constructor(public party: Party.Party) {}

  onConnect(conn: Party.Connection) {
    if (this.playerOrder.length >= 2) {
      conn.send(JSON.stringify({ type: "room_full" }));
      conn.close();
      return;
    }
    const idx = this.playerOrder.length;
    this.playerOrder.push(conn.id);
    this.playerData.set(conn.id, { playerIndex: idx });
    conn.send(JSON.stringify({ type: "connected", playerIndex: idx, count: this.playerOrder.length }));
    if (idx === 1) {
      this.broadcast(JSON.stringify({ type: "player_joined" }));
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);

      if (data.type === "join") {
        const pd = this.playerData.get(sender.id);
        if (pd) { pd.stats = data.stats; pd.imgSrc = data.imgSrc; }

        const all = this.playerOrder.map(id => this.playerData.get(id));
        if (all.length === 2 && all[0]?.stats && all[1]?.stats) {
          this.playerOrder.forEach((id, i) => {
            const c = this.party.getConnection(id);
            c?.send(JSON.stringify({
              type: "battle_start",
              you: i,
              p1: { stats: all[0]!.stats, imgSrc: all[0]!.imgSrc },
              p2: { stats: all[1]!.stats, imgSrc: all[1]!.imgSrc },
            }));
          });
        } else {
          sender.send(JSON.stringify({ type: "waiting_opponent" }));
        }
      }

      if (data.type === "move") {
        const pd = this.playerData.get(sender.id);
        if (pd) { pd.move = data.move; pd.feintDeclared = data.feintDeclared ?? null; }

        const all = this.playerOrder.map(id => this.playerData.get(id));
        if (all.length === 2 && all[0]?.move && all[1]?.move) {
          this.broadcast(JSON.stringify({
            type: "resolve",
            p1: { move: all[0].move, feintDeclared: all[0].feintDeclared },
            p2: { move: all[1].move, feintDeclared: all[1].feintDeclared },
          }));
          all.forEach(pd => { if (pd) { pd.move = undefined; pd.feintDeclared = undefined; } });
        } else {
          sender.send(JSON.stringify({ type: "waiting_move" }));
        }
      }
    } catch (_) {}
  }

  onClose(conn: Party.Connection) {
    this.playerOrder = this.playerOrder.filter(id => id !== conn.id);
    this.playerData.delete(conn.id);
    this.broadcast(JSON.stringify({ type: "player_left" }));
  }

  broadcast(msg: string) {
    for (const conn of this.party.getConnections()) conn.send(msg);
  }
}
