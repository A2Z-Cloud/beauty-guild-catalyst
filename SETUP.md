# Beauty Guild Catalyst project — setup for a new machine

This is the Zoho Catalyst project for the Beauty Guild Accreditation portal: a React client
(`beautyguildclient/`) and one Advanced I/O backend function (`functions/beauty_guild_api/`).

node_modules, build output and .git history were stripped out before sending, so you'll need to
regenerate the first two and start fresh on version control.

## 1. Install the Catalyst CLI (if you don't have it)

```
npm install -g zcatalyst-cli
```

## 2. Log in and link this folder to the BeautyGuild Catalyst project

```
catalyst login
catalyst project:list        # find "BeautyGuild"
catalyst project:use         # select it, select the "Development" environment
```
This asks the project owner (Karthik) to add you as a user on the Catalyst project first,
in the Zoho Catalyst console, otherwise `project:use` won't find it.

## 3. Install dependencies

```
cd beautyguildclient && npm install
cd ../functions/beauty_guild_api && npm install
```

## 4. Run it locally

From the `catalyst/` root (this folder):
```
catalyst serve --http 5000
```
Client at http://localhost:5000/app/, the API at http://localhost:5000/server/beauty_guild_api/.

Drop `--http 5000` to use Catalyst's default ports if 5000 is already taken on your machine.

## Notes

- The CRM connection (`zohocrm`) that the function calls through is configured server-side in the
  Catalyst console, not in this code. You don't need to set up any API keys locally.
- There is currently no shared git remote for this project, only local, uncommitted work.
  Once you've made changes, coordinate with Karthik before both of you edit the same files, since
  there's no repo yet to merge through.
