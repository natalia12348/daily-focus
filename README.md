# Daily Focus

A calm, pink to-do list built for busy, ADHD-friendly mornings. Type what you need to do today, tick it off, and watch the day fill up.

## Features

- **Today list** with four priority colors (Urgent, Important, Medium, Someday), a daily progress bar, a streak counter and confetti when you finish something.
- **"I don't know where to start"** picks one task for you, so you never stare at a long list.
- **Goals** (for example "learn Agile"): let AI split a goal into stages and small tasks, paste your own plan, or write it by hand. Send any task to Today with one click.
- **Habits** (Spanish, drinking water, anything daily): slide to mark today as done and see which weekdays you showed up.
- **Quote of the day** at the top, changing every day.
- **Private by design**: every user only sees their own data, synced across devices.

## Tech

- Static site: plain HTML, CSS and JavaScript, no build step.
- [Supabase](https://supabase.com) for sign-in (email magic link) and a Postgres database with row-level security.
- Optional AI features call the Anthropic API directly from the browser with the user's own API key, so hosting stays free.
- Hosted on [Vercel](https://vercel.com).

Everything runs on free tiers.

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

## License

MIT
