# Setup

## Run it locally

```bash
git clone https://github.com/natalia12348/daily-focus.git
cd daily-focus
python3 -m http.server 8000
```

Open http://localhost:8000. With an empty `config.js` the app runs in local-only mode and saves to the browser.

## Turn on accounts and sync

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. In **Authentication > URL Configuration**, set the Site URL to your deployed address and add it (and `http://localhost:8000`) to the redirect URLs.
4. Copy the project URL and the `anon` public key from **Project Settings > API** into [`config.js`](config.js).

The anon key is meant to be public. Row-level security makes sure each user can only read and change their own rows.

## AI features

Open **AI key** at the bottom of the app and paste an Anthropic API key. It is stored only in your browser and sent only to `api.anthropic.com`. Without a key, everything except the AI buttons works.

## Deploy

```bash
npx vercel --prod
```
