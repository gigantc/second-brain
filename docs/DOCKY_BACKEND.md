# Docky Firestore CRUD (Direct)

Docky uses Firestore collections directly (no Cloud Functions).
This doc explains how the assistant can create/update/delete/list Notes, Lists, Journals, and Briefs via the CLI helper.

## Data model (current app)
Collections used by Docky today:
- `notes` → `type: note | journal | brief`
- `lists` → list documents with `items[]`

Notes schema:
```ts
{
  title: string,
  content: string,
  tags: string[],
  type: "note" | "journal" | "brief",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Lists schema:
```ts
{
  title: string,
  items: { id, text, completed, createdAt }[],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## CLI helper
Script: `docky/scripts/docky-cli.js`

Examples:
```bash
# Create
npm run docky:cli -- create note --title "Idea" --content "..." --tags "ai,work"
npm run docky:cli -- create journal --title "Daily Journal — 2026-02-05" --content "..."
npm run docky:cli -- create brief --title "Morning Brief — 2026-02-05" --content "..."
npm run docky:cli -- create list --title "Groceries" --items "eggs; cheese; coffee"

# List
npm run docky:cli -- list note --limit 20
npm run docky:cli -- list list --limit 20

# Get
npm run docky:cli -- get note --id <docId>

# Update
npm run docky:cli -- update note --id <docId> --title "New title"
npm run docky:cli -- update list --id <docId> --items "one; two; three"

# Delete
npm run docky:cli -- delete note --id <docId>
```

## Auth
Uses Firebase client SDK + email/password from `.env`:
- `DOCKY_EMAIL`
- `DOCKY_PASSWORD`

## Notes
- No Cloud Functions are deployed.
- Firestore rules should already allow the app’s authenticated user.
