# Put Schmeckers on GitHub

Your project folder is ready for GitHub at: `~/checkers`

## Step 1 — Create the repo on GitHub (website)

1. Go to https://github.com/new  
2. **Repository name:** `schmeckers-checkers` (or any name you like)  
3. Leave it **Public** or **Private** — your choice  
4. **Do NOT** check “Add a README” (you already have files)  
5. Click **Create repository**

## Step 2 — Push from Terminal

GitHub will show commands. Use these (replace `YOUR_USERNAME` with your GitHub username):

```bash
cd ~/checkers
git remote add origin https://github.com/YOUR_USERNAME/schmeckers-checkers.git
git branch -M main
git push -u origin main
```

It will ask you to sign in. Use a **Personal Access Token** as the password if prompted (not your GitHub password).

### Create a token (if needed)

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**  
2. **Generate new token** → check **repo**  
3. Copy the token and paste it when Terminal asks for a password  

## Step 3 — Connect Render

1. https://render.com → **New** → **Web Service**  
2. **Connect GitHub** → choose `schmeckers-checkers`  
3. **Build command:** `npm install`  
4. **Start command:** `npm start`  
5. **Deploy**

Your live URL will look like: `https://schmeckers-checkers.onrender.com`

Share that link with your friend on both phones.
