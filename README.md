# Schmeckers

Multiplayer American checkers in the browser. A transparent 8×8 grid sits on top of your hand-drawn board art; pieces are placeholder gradients until you swap in PNGs.

## Setup

```bash
cd ~/Developer/hand-drawn-checkers
npm install
npm start
```

Open http://localhost:3000 in two browser windows (or send the URL to a friend on the same network).

## Art assets

| File | Purpose |
|------|---------|
| `public/board-bg.png` | Full board illustration (replace `board-bg.svg` in `index.html`) |
| `public/piece-red.png` | Red/light piece sprite |
| `public/piece-black.png` | Black/dark piece sprite |

Uncomment the `background: url(...)` rules in `style.css` for `.piece.red` and `.piece.black`.

## How it works

- **Player 1 (Red)** joins first; **Player 2 (Black)** joins second.
- Moves are click-to-move: select your piece, then a highlighted square.
- Jumps, multi-jumps, and kings are enforced on both client and server.
- If someone disconnects, the game resets and waits for a new opponent.
