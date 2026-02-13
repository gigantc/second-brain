import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil, Save, Trash2, X } from 'lucide-react'

export default function SortableListItem({
  item,
  isEditing,
  editDraft,
  onStartEdit,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  onToggle,
  onDelete,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-item-id={item.id}
      className={`list-item list-item--sortable ${item.completed ? 'is-complete' : ''} ${isDragging ? 'is-dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="list-item__swipe" aria-hidden="true" />
      <button
        className="list-item__checkbox"
        type="button"
        onClick={onToggle}
        aria-pressed={item.completed}
      >
        <span className="list-item__check" />
      </button>

      {isEditing ? (
        <div className="list-item__edit-wrap" onPointerDown={(event) => event.stopPropagation()}>
          <input
            className="list-item__edit-input"
            type="text"
            value={editDraft}
            onChange={(event) => onEditDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onSaveEdit()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                onCancelEdit()
              }
            }}
            autoFocus
          />
          <button className="list-item__action" type="button" onClick={onSaveEdit} aria-label="Save item" title="Save">
            <Save aria-hidden="true" size={14} strokeWidth={2} />
          </button>
          <button className="list-item__action" type="button" onClick={onCancelEdit} aria-label="Cancel edit" title="Cancel">
            <X aria-hidden="true" size={14} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <>
          <span className="list-item__text">{item.text}</span>
          <button
            className="list-item__action"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onStartEdit()
            }}
            aria-label="Edit item"
            title="Edit item"
          >
            <Pencil aria-hidden="true" size={14} strokeWidth={2} />
          </button>
        </>
      )}

      <button
        className="list-item__delete"
        type="button"
        onClick={onDelete}
        aria-label="Delete item"
        title="Delete item"
      >
        <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
      </button>
    </li>
  )
}
