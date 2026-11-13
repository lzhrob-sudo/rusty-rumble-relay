/* Rusty Rumble online protocol (shared by the relay server and the game's NetClient).
   Every message is a small JSON object with a `type`. The server has no game logic:
   it makes rooms, enforces 2 players per room and relays `state` between them. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O/1/I/L
const CODE_LEN = 5;
const VERSION = 1;
const C2S = { CREATE:'create', JOIN:'join', LEAVE:'leave', STATE:'state' };            // client → server
const S2C = { CREATED:'created', JOINED:'joined', PEER_JOINED:'peer_joined',          // server → client
              PEER_LEFT:'peer_left', STATE:'state', ERROR:'error' };
const ERR = { NOT_FOUND:'not_found', FULL:'full', EXPIRED:'expired', BAD:'bad_request', VERSION:'version' };
const LIMITS = { maxPlayers:2, unusedRoomMs:10 * 60 * 1000, maxMessageBytes:16 * 1024, maxMessagesPerSecond:60 };
function makeCode(rand = Math.random) { let s = ''; for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)]; return s; }
function normalizeCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN); }
const api = { ALPHABET, CODE_LEN, VERSION, C2S, S2C, ERR, LIMITS, makeCode, normalizeCode };
if (typeof module !== 'undefined') module.exports = api;
