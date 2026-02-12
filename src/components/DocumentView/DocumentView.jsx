import { Pencil, Trash2 } from 'lucide-react'
import './DocumentView.scss'

export default function DocumentView({
  activeDoc,
  briefGreeting,
  user,
  onEdit,
  onDeleteBrief,
}) {
  return (
    <article className="doc">
      <header className="doc__header">
        <div className="doc__title">
          <h1>{briefGreeting || activeDoc.title}</h1>
          {activeDoc.isBrief && (
            <div className="doc__date">{activeDoc.title}</div>
          )}
          {!activeDoc.isBrief && activeDoc.created && (
            <div className="doc__date">{activeDoc.created}</div>
          )}
          {activeDoc.tags.length > 0 && (
            <div className="doc__tags">
              {activeDoc.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}
          {user && !activeDoc.isBrief && (
            <div className="doc__actions">
              <button className="doc__button" onClick={() => onEdit(activeDoc)} aria-label="Edit note" title="Edit note">
                <Pencil aria-hidden="true" size={16} strokeWidth={2} />
                <span>Edit</span>
              </button>
            </div>
          )}
        </div>
        {user && activeDoc.isBrief && (
          <button
            className="doc__brief-delete"
            type="button"
            onClick={() => onDeleteBrief(activeDoc)}
            aria-label="Delete brief"
            title="Delete brief"
          >
            <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
            <span>Delete</span>
          </button>
        )}
      </header>
      <div
        className="doc__content"
        dangerouslySetInnerHTML={{ __html: activeDoc.html }}
      />
    </article>
  )
}
