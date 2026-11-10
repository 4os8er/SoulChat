# SoulChat setup

## Current state
The repository currently contains a lightweight HTML/CSS starter. This branch upgrades the experience and adds a Supabase-powered authentication + realtime messaging client scaffold.

## Run locally
Because the app uses browser ES modules, serve this folder with a local static server (for example VS Code Live Server). Opening index.html as a file may block module imports.

## Configure Supabase
1. Create a Supabase project.
2. In the project SQL editor, create the tables and policies from `supabase/schema.sql`.
3. Create a private Storage bucket named `chat-media` and apply the storage policies in the schema file.
4. Create two user accounts in Supabase Auth.
5. Add a `config.js` file in the project root (do not commit real credentials):
   ```js
   window.SOULCHAT_SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
   window.SOULCHAT_SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";
   window.SOULCHAT_CONVERSATION_ID = "YOUR_CONVERSATION_UUID";
   ```
6. Add `<script src="config.js"></script>` immediately before `<script type="module" src="script.js"></script>` in index.html.
7. Enable Realtime for the messages table.

Only the Supabase anon/publishable key belongs in browser configuration. Never expose the service-role key.

## Important
The interface and client integration are a foundation, not a claim that the production service is fully configured. Apply and test RLS policies before adding real private conversations. Review storage access, auth allow-list, rate limits, backups and deployment settings before production.
