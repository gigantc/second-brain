#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  limit as fsLimit,
} from 'firebase/firestore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const usage = `Docky Firestore CLI

Usage:
  node scripts/docky-cli.js create <note|journal|brief|list> [options]
  node scripts/docky-cli.js update <note|journal|brief|list> --id <docId> [options]
  node scripts/docky-cli.js delete <note|journal|brief|list> --id <docId>
  node scripts/docky-cli.js get <note|journal|brief|list> --id <docId>
  node scripts/docky-cli.js list <note|journal|brief|list> [--limit 50]

Options (create/update):
  --title "Title"
  --content "Markdown content"
  --file /path/to/content.md
  --tags "tag1, tag2"
  --items "item one; item two" (lists only; can also be JSON array)

Environment:
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
  DOCKY_EMAIL
  DOCKY_PASSWORD
`

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eq = trimmed.indexOf('=')
    if (eq === -1) return
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  })
}

function parseArgs(argv) {
  const args = [...argv]
  const command = args.shift()
  const type = args.shift()
  const options = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = args[i + 1]
    if (!next || next.startsWith('--')) {
      options[key] = true
    } else {
      options[key] = next
      i += 1
    }
  }
  return { command, type, options }
}

function parseItems(input) {
  if (!input) return []
  const trimmed = input.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed.map((item) => String(item))
    return []
  }
  return trimmed
    .split(/;|\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildListItems(items) {
  return items.map((text) => ({
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: Date.now(),
  }))
}

function getConfig() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Missing Firebase config. Ensure VITE_FIREBASE_* vars are set.')
  }

  const email = process.env.DOCKY_EMAIL
  const password = process.env.DOCKY_PASSWORD
  if (!email || !password) {
    throw new Error('Missing DOCKY_EMAIL or DOCKY_PASSWORD in env.')
  }

  return { firebaseConfig, email, password }
}

function collectionForType(db, type) {
  if (type === 'list') return collection(db, 'lists')
  return collection(db, 'notes')
}

async function main() {
  loadDotEnv(path.join(repoRoot, '.env'))

  const { command, type, options } = parseArgs(process.argv.slice(2))
  if (!command || !type || options.help || options.h) {
    console.log(usage)
    process.exit(0)
  }

  const normalizedType = type.toLowerCase()
  if (!['note', 'journal', 'brief', 'list'].includes(normalizedType)) {
    console.error(`Unknown type: ${type}`)
    console.log(usage)
    process.exit(1)
  }

  const { firebaseConfig, email, password } = getConfig()

  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)
  await signInWithEmailAndPassword(auth, email, password)

  if (command === 'create') {
    const title = options.title || 'Untitled'
    let content = options.content || ''
    if (options.file) content = fs.readFileSync(path.resolve(process.cwd(), options.file), 'utf8')

    if (normalizedType === 'list') {
      const items = buildListItems(parseItems(options.items || ''))
      const ref = await addDoc(collectionForType(db, normalizedType), {
        title,
        items,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      console.log(`Created list ${ref.id}`)
      return
    }

    const tags = (options.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const ref = await addDoc(collectionForType(db, normalizedType), {
      title,
      content,
      tags,
      type: normalizedType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log(`Created ${normalizedType} ${ref.id}`)
    return
  }

  if (command === 'update') {
    if (!options.id) throw new Error('Missing --id for update')
    const targetRef = doc(collectionForType(db, normalizedType), options.id)

    if (normalizedType === 'list') {
      const updates = {}
      if (options.title !== undefined) updates.title = options.title
      if (options.items !== undefined) updates.items = buildListItems(parseItems(options.items))
      updates.updatedAt = serverTimestamp()
      await updateDoc(targetRef, updates)
      console.log(`Updated list ${options.id}`)
      return
    }

    const updates = {}
    if (options.title !== undefined) updates.title = options.title
    if (options.content !== undefined) updates.content = options.content
    if (options.file) updates.content = fs.readFileSync(path.resolve(process.cwd(), options.file), 'utf8')
    if (options.tags !== undefined) {
      updates.tags = String(options.tags)
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    }
    updates.updatedAt = serverTimestamp()

    await updateDoc(targetRef, updates)
    console.log(`Updated ${normalizedType} ${options.id}`)
    return
  }

  if (command === 'delete') {
    if (!options.id) throw new Error('Missing --id for delete')
    const targetRef = doc(collectionForType(db, normalizedType), options.id)
    await deleteDoc(targetRef)
    console.log(`Deleted ${normalizedType} ${options.id}`)
    return
  }

  if (command === 'get') {
    if (!options.id) throw new Error('Missing --id for get')
    const targetRef = doc(collectionForType(db, normalizedType), options.id)
    const snapshot = await getDoc(targetRef)
    if (!snapshot.exists()) {
      console.log('Not found')
      return
    }
    console.log(JSON.stringify({ id: snapshot.id, ...snapshot.data() }, null, 2))
    return
  }

  if (command === 'list') {
    const lim = Math.min(parseInt(options.limit || '50', 10) || 50, 200)
    let q = query(collectionForType(db, normalizedType), orderBy('updatedAt', 'desc'), fsLimit(lim))

    if (normalizedType !== 'list') {
      q = query(
        collectionForType(db, normalizedType),
        where('type', '==', normalizedType),
        orderBy('updatedAt', 'desc'),
        fsLimit(lim)
      )
    }

    const snap = await getDocs(q)
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    console.log(JSON.stringify({ items }, null, 2))
    return
  }

  console.log(usage)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
