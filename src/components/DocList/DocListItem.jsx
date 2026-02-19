import { memo } from 'react'
import { highlightText } from '../../utils/string.jsx'

export default memo(function DocListItem({ doc, isActive, query, onClick }) {
  return (
    <button
      className={`doc-list__item ${isActive ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <div className="doc-list__title">
        {highlightText(doc.title, query)}
      </div>
      <div className="doc-list__meta">
        {highlightText(doc.updated || doc.created || doc.slug, query)}
      </div>
    </button>
  )
})
