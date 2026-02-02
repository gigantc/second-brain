# Docky
An App that keeps track of things I do with my Moltbot Rocky.

A Vite + React + Sass app that renders markdown docs from `/docs`.

## Quick start
```bash
npm install
npm run dev
```

## Docs
- Add markdown files under `/docs` (and `/docs/journal`).
- Front‑matter is optional. If present, supported fields:
  - `title`
  - `created`
  - `tags` (array)

Example:
```md
---
title: My Note
created: 2026-01-29
tags: [ai, dev]
---

# Heading
```

## Roadmap (MVP)
- Sidebar list + search
- Markdown viewer
- Daily journal entries in `/docs/journal`
