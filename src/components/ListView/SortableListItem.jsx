import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ListItemContent from './ListItemContent'

export default memo(function SortableListItem({
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
      <ListItemContent
        item={item}
        isEditing={isEditing}
        editDraft={editDraft}
        onStartEdit={onStartEdit}
        onEditDraftChange={onEditDraftChange}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    </li>
  )
})
