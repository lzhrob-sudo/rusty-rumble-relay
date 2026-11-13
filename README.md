# Rusty Rumble relay server

A tiny WebSocket relay for Rusty Rumble's online duels. It only makes rooms (5-character
codes, no 0/O/1/I/L), lets one friend join (max 2 players), and passes each player's
state to the other. All game logic runs on the room creator's device (the host).

## Run it locally

```bash
cd server
npm install
npm start            # listens on ws://localhost:8787
```

Open the game with `?server=ws://localhost:8787` added to its URL (debug builds only)
in two browser windows: one taps **2 Players → Create room**, the other **Join room**
and types the code.

## Settings (environment variables)

| Variable          | Default | Meaning                                                                |
|-------------------|---------|------------------------------------------------------------------------|
| `PORT`            | `8787`  | Port to listen on (most hosts set this for you).                       |
| `ALLOWED_ORIGINS` | (empty) | Comma-separated origins allowed to connect, e.g. `https://www.crazygames.com,*.crazygames.com`. Empty allows all (fine for testing). |

Unused room codes expire after 10 minutes. Health check: `GET /healthz` returns `ok`.

## What a host must provide

* Runs Node 18+ with `npm start`, and **supports WebSockets** (the address will start with `wss://`).
* **Always on.** Some free plans put the service to sleep when idle; the first player then waits a
  minute or more and the connection can fail. Use a plan that does not sleep for the real launch.
* Very small: a room is a few kilobytes and nothing is stored on disk.

## Deploy, for example on Render (works from a browser, no command line)

1. Put the files of this folder in a GitHub repository (github.com → New repository → *uploading
   an existing file*; unzip the package in the Files app first). Keep `package.json` at the top level.
2. On render.com: **New → Web Service**, connect that repository.
3. Build command `npm install`, start command `npm start`. Choose an instance type that does not sleep.
4. Open the service's **Environment** tab. Leave `ALLOWED_ORIGINS` empty for the first test.
5. When it is live you get `https://something.onrender.com`. Open `https://something.onrender.com/healthz`:
   it must show `ok`. Your game's relay address is the same name with `wss://`:
   `wss://something.onrender.com`.
6. Send that address to the person building the game. After you have tested one match through the
   CrazyGames preview, open the service's **Logs**: each new origin is printed once, e.g.
   `origin https://some-game.game-files.crazygames.com ok`. Then set
   `ALLOWED_ORIGINS` to `*.crazygames.com` and redeploy (this stops other sites using your relay).

Any other host works the same way (Railway, Fly.io, a small VPS with a reverse proxy that does
HTTPS). A `Dockerfile` is included for hosts that build from one.

## Point the game at it

The game build takes the address as one option (the person building the game runs
`python3 build.py --server=wss://your-relay-host`). Until an address is set, the **2 Players**
button stays hidden, so players never see a mode that cannot work.

The claude.ai preview doesn't need the relay: it uses the page's own live "room" connection instead.

## Keeping it healthy

* The relay stores nothing and logs only each distinct origin once (no IP addresses, no names).
* If the relay is down, only 2 Players says "Couldn't connect, try again"; the rest of the game is unaffected.
* Change the game's `NET.VERSION` only when the message format changes; players on an old
  version then get a clear "version" error instead of a broken match.

## Protocol

`protocol.js` (shared with the game) defines every message. Client → server: `create`,
`join {code}`, `leave`, `state {data}`. Server → client: `created {code}`,
`joined {code}`, `peer_joined`, `peer_left`, `state {data}`, `error {reason}` where
`reason` is `not_found`, `full`, `expired`, `bad_request` or `version`.
