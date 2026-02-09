import { marked } from 'marked'
import { slugify } from './string'

const FRONT_MATTER_REGEX = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/

export function renderMarkdownWithOutline(content) {
  const renderer = new marked.Renderer()
  const outline = []
  const counts = {}
  const cleaned = content.replace(FRONT_MATTER_REGEX, '')

  renderer.heading = (token) => {
    const level = token.depth ?? token.level
    const text = token.text ?? ''

    if (level < 2 || level > 3) {
      return `<h${level}>${text}</h${level}>`
    }

    const base = slugify(text)
    const count = (counts[base] = (counts[base] || 0) + 1)
    const id = count > 1 ? `${base}-${count}` : base
    outline.push({ level, text, id })
    return `<h${level} id="${id}">${text}</h${level}>`
  }

  const html = marked.parse(cleaned, { renderer })
  return { html, outline }
}

export function parseBriefMarkets(content) {
  const lines = content.split('\n')
  const keys = ['S&P 500', 'Nasdaq', 'Dow', 'BTC', 'ETH']
  const results = {}

  const extractValue = (line) => {
    const match = line.match(/:\s*\$?([0-9][0-9,]*\.?\d*)/)
    if (!match) return null
    const numeric = Number(match[1].replace(/,/g, ''))
    return Number.isNaN(numeric) ? null : numeric
  }

  lines.forEach((line) => {
    keys.forEach((key) => {
      if (line.includes(key)) {
        results[key] = {
          raw: line.replace(/^-\s*/, '').trim(),
          value: extractValue(line),
        }
      }
    })
  })

  return results
}
