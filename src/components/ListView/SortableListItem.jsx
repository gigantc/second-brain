import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2 } from 'lucide-react'

export default function SortableListItem({ item, onToggle, onDelete }) {
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
      <span className="list-item__text">{item.text}</span>
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
