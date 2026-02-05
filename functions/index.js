const functions = require('firebase-functions')
const admin = require('firebase-admin')
const express = require('express')
const cors = require('cors')

admin.initializeApp()
const db = admin.firestore()

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

const ALLOWED_TYPES = new Set(['note', 'list', 'journal', 'brief'])
const ALLOWED_STATUS = new Set(['active', 'archived', 'deleted'])

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' })
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.user = { uid: decoded.uid }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid auth token' })
  }
}

function userItemsRef(uid) {
  return db.collection('users').doc(uid).collection('items')
}

function sanitizeItemInput(body = {}) {
  const type = body.type
  if (!ALLOWED_TYPES.has(type)) throw new Error('Invalid type')

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const textBody = typeof body.body === 'string' ? body.body : ''
  const tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : []
  const status = body.status && ALLOWED_STATUS.has(body.status) ? body.status : 'active'
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : {}

  return { type, title, body: textBody, tags, status, meta }
}

app.use(requireAuth)

// Create item
app.post('/api/items', async (req, res) => {
  try {
    const uid = req.user.uid
    const data = sanitizeItemInput(req.body)
    const now = admin.firestore.FieldValue.serverTimestamp()

    const docRef = await userItemsRef(uid).add({
      ...data,
      createdAt: now,
      updatedAt: now,
    })

    return res.status(201).json({ id: docRef.id })
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
})

// List items
app.get('/api/items', async (req, res) => {
  try {
    const uid = req.user.uid
    const { type, status = 'active', limit = '50' } = req.query

    let q = userItemsRef(uid)

    if (type) {
      if (!ALLOWED_TYPES.has(type)) throw new Error('Invalid type')
      q = q.where('type', '==', type)
    }

    if (status) {
      if (!ALLOWED_STATUS.has(status)) throw new Error('Invalid status')
      q = q.where('status', '==', status)
    }

    const lim = Math.min(parseInt(limit, 10) || 50, 200)
    q = q.orderBy('updatedAt', 'desc').limit(lim)

    const snap = await q.get()
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    return res.json({ items })
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
})

// Get item
app.get('/api/items/:id', async (req, res) => {
  try {
    const uid = req.user.uid
    const ref = userItemsRef(uid).doc(req.params.id)
    const doc = await ref.get()

    if (!doc.exists) return res.status(404).json({ error: 'Not found' })

    return res.json({ id: doc.id, ...doc.data() })
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
})

// Update item
app.patch('/api/items/:id', async (req, res) => {
  try {
    const uid = req.user.uid
    const ref = userItemsRef(uid).doc(req.params.id)

    const updates = {}
    if (req.body.title !== undefined) updates.title = String(req.body.title)
    if (req.body.body !== undefined) updates.body = String(req.body.body)
    if (req.body.tags !== undefined) updates.tags = Array.isArray(req.body.tags) ? req.body.tags : []
    if (req.body.status !== undefined) {
      if (!ALLOWED_STATUS.has(req.body.status)) throw new Error('Invalid status')
      updates.status = req.body.status
    }
    if (req.body.meta !== undefined) updates.meta = req.body.meta

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp()

    await ref.set(updates, { merge: true })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
})

// Soft delete
app.delete('/api/items/:id', async (req, res) => {
  try {
    const uid = req.user.uid
    const ref = userItemsRef(uid).doc(req.params.id)
    await ref.set(
      {
        status: 'deleted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return res.json({ ok: true })
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
})

exports.api = functions.https.onRequest(app)
