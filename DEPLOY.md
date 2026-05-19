# Play Schmeckers with a friend on your phones

## Option A — Free online hosting (Render) ~10 minutes

Best for playing anywhere (not just home Wi‑Fi).

1. Create a free account at https://render.com  
2. Push this folder to GitHub (or use Render’s “Deploy from Git” upload).  
3. On Render: **New → Web Service** → connect the repo.  
4. Settings (Render usually auto-detects):
   - **Build command:** `npm install`
   - **Start command:** `npm start`
5. Click **Deploy**. Wait until status is **Live**.  
6. Copy the URL (like `https://schmeckers-checkers.onrender.com`).  
7. **You** open that URL on your phone (Red).  
8. **Friend** opens the **same** URL on their phone (Blue).

**Note:** Free Render apps sleep after ~15 min idle. First visit may take 30–60 seconds to wake up.

---

## Option B — Quick test tonight (ngrok)

Good for a one-off game without full deploy.

1. Start the game on your Mac: double-click **START-SCHMECKERS.command**  
2. Install ngrok: https://ngrok.com/download  
3. In Terminal: `ngrok http 3000`  
4. Copy the `https://….ngrok-free.app` link  
5. Both phones open that link (must stay on Wi‑Fi while your Mac runs the server)

---

## Option C — Same Wi‑Fi only

1. Start the game on your Mac  
2. Find your Mac’s IP: **System Settings → Network → Wi‑Fi → Details** (e.g. `192.168.1.42`)  
3. On each phone: `http://192.168.1.42:3000`  
4. Both must be on the **same** Wi‑Fi

---

## How to play (2 players)

1. Player 1 opens the link first → **Red**  
2. Player 2 opens the same link → **Blue**  
3. On your turn: **drag** a piece to a green circle, or **tap** your piece then tap a green square  
4. Red always moves first
