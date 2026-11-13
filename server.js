/* Rusty Rumble relay: Node.js + ws. Rooms by 5-character code, max 2 players,
   relays `state` messages between them. No game logic here.
   Env: PORT (default 8787), ALLOWED_ORIGINS (comma-separated; empty = allow all). */
const http = require('http');
const { WebSocketServer } = require('ws');
const P = require('./protocol');

const PORT = Number(process.env.PORT) || 8787;
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const rooms = new Map();   // code -> { code, players:[ws], createdAt, joined:false }

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'content-type':'text/plain' }); res.end('ok'); return; }
  res.writeHead(200, { 'content-type':'text/plain' }); res.end('Rusty Rumble relay. Rooms open: ' + rooms.size);
});
const originOk = origin => !ALLOWED.length || ALLOWED.includes(origin) ||
  ALLOWED.some(a => a.startsWith('*.') && origin && origin.endsWith(a.slice(1)));
const seenOrigins = new Set();
const wss = new WebSocketServer({ server, maxPayload:P.LIMITS.maxMessageBytes,
  verifyClient:({ origin }, cb) => { const ok = originOk(origin); const k = (origin || '(none)') + (ok ? ' ok' : ' BLOCKED'); if (!seenOrigins.has(k)) { seenOrigins.add(k); console.log('origin', k); } cb(ok, 403, 'origin not allowed'); } });   // logs each distinct origin once (no IPs, no names)

const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const other = (room, ws) => room.players.find(p => p !== ws);

function newCode() { let c; do c = P.makeCode(); while (rooms.has(c)); return c; }
function leave(ws) {
  const room = ws.room; if (!room) return;
  ws.room = null; room.players = room.players.filter(p => p !== ws);
  if (room.players.length) send(room.players[0], { type:P.S2C.PEER_LEFT });
  else rooms.delete(room.code);
}

wss.on('connection', ws => {
  ws.room = null; ws.alive = true; ws.bucket = { t:Date.now(), n:0 };
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    const now = Date.now();                              // simple rate limit
    if (now - ws.bucket.t > 1000) { ws.bucket.t = now; ws.bucket.n = 0; }
    if (++ws.bucket.n > P.LIMITS.maxMessagesPerSecond) return;
    let m; try { m = JSON.parse(raw); } catch (_) { return send(ws, { type:P.S2C.ERROR, reason:P.ERR.BAD }); }
    if (!m || typeof m.type !== 'string') return;
    switch (m.type) {
      case P.C2S.CREATE: {
        if (m.v !== undefined && m.v !== P.VERSION) return send(ws, { type:P.S2C.ERROR, reason:P.ERR.VERSION });
        leave(ws);
        const room = { code:newCode(), players:[ws], createdAt:now, joined:false };
        rooms.set(room.code, room); ws.room = room;
        return send(ws, { type:P.S2C.CREATED, code:room.code });
      }
      case P.C2S.JOIN: {
        if (m.v !== undefined && m.v !== P.VERSION) return send(ws, { type:P.S2C.ERROR, reason:P.ERR.VERSION });
        const room = rooms.get(P.normalizeCode(m.code));
        if (!room) return send(ws, { type:P.S2C.ERROR, reason:P.ERR.NOT_FOUND });
        if (room.players.includes(ws)) return send(ws, { type:P.S2C.JOINED, code:room.code });
        if (room.players.length >= P.LIMITS.maxPlayers) return send(ws, { type:P.S2C.ERROR, reason:P.ERR.FULL });
        leave(ws); room.players.push(ws); room.joined = true; ws.room = room;
        send(ws, { type:P.S2C.JOINED, code:room.code });
        return send(other(room, ws), { type:P.S2C.PEER_JOINED });
      }
      case P.C2S.STATE: {                                // relay to the other player only
        const room = ws.room; if (!room) return;
        return send(other(room, ws), { type:P.S2C.STATE, data:m.data });
      }
      case P.C2S.LEAVE: return leave(ws);
    }
  });
  ws.on('close', () => leave(ws));
});

setInterval(() => {                                      // heartbeat + expire unused codes
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  const now = Date.now();
  for (const room of rooms.values()) if (!room.joined && now - room.createdAt > P.LIMITS.unusedRoomMs) {
    for (const ws of room.players) { send(ws, { type:P.S2C.ERROR, reason:P.ERR.EXPIRED }); ws.room = null; }
    rooms.delete(room.code);
  }
}, 15000);

server.listen(PORT, () => console.log('Rusty Rumble relay on :' + PORT + (ALLOWED.length ? ' (origins: ' + ALLOWED.join(', ') + ')' : ' (all origins)')));
