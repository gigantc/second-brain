import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import SortableListItem from './SortableListItem'
import ListItemContent from './ListItemContent'
import './ListView.scss'

export default function ListView({
  activeList,
  listStats,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onEditItem,
  onDeleteList,
  onRenameList,
  onDragEnd,
}) {
  const [newItemText, setNewItemText] = useState('')
  const [isEditingListTitle, setIsEditingListTitle] = useState(false)
  const [listTitleDraft, setListTitleDraft] = useState('')
  const [editingItemId, setEditingItemId] = useState(null)
  const [editingItemDraft, setEditingItemDraft] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  useEffect(() => {
    setIsEditingListTitle(false)
    setListTitleDraft(activeList?.title || '')
    setEditingItemId(null)
    setEditingItemDraft('')
  }, [activeList?.id, activeList?.title])

  const incompleteItems = useMemo(() => {
    if (!activeList?.items?.length) return []
    return activeList.items.filter((item) => !item.completed)
  }, [activeList])

  const completedItems = useMemo(() => {
    if (!activeList?.items?.length) return []
    return activeList.items.filter((item) => item.completed)
  }, [activeList])

  const listItems = useMemo(() => [...incompleteItems, ...completedItems], [incompleteItems, completedItems])

  const handleAdd = () => {
    if (!newItemText.trim()) return
    onAddItem(newItemText.trim())
    setNewItemText('')
  }

  const handleRename = () => {
    onRenameList(listTitleDraft.trim() || 'Untitled List')
    setIsEditingListTitle(false)
  }

  const beginEditItem = (item) => {
    setEditingItemId(item.id)
    setEditingItemDraft(item.text || '')
  }

  const cancelEditItem = () => {
    setEditingItemId(null)
    setEditingItemDraft('')
  }

  const saveEditItem = async (listId, itemId) => {
    const next = editingItemDraft.trim()
    if (!next) return
    await onEditItem(listId, itemId, next)
    cancelEditItem()
  }

  return (
    <article className="list">
      <header className="list__header">
        <div className="list__title">
          {isEditingListTitle ? (
            <input
              className="list__title-input"
              type="text"
              value={listTitleDraft}
              onChange={(event) => setListTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleRename()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setIsEditingListTitle(false)
                  setListTitleDraft(activeList.title || '')
                }
              }}
              autoFocus
            />
          ) : (
            <h1>{activeList.title}</h1>
          )}
          <div className="list__meta">
            {listStats?.completed ?? 0} of {listStats?.total ?? 0} done
          </div>
        </div>
        <div className="list__panel">
          {isEditingListTitle ? (
            <>
              <button className="list__icon" type="button" onClick={handleRename} aria-label="Save list name" data-tooltip="Save">
                <Save aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              <button className="list__icon" type="button" onClick={() => { setIsEditingListTitle(false); setListTitleDraft(activeList.title || '') }} aria-label="Cancel rename" data-tooltip="Cancel">
                <X aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </>
          ) : (
            <button className="list__icon" type="button" onClick={() => { setIsEditingListTitle(true); setListTitleDraft(activeList.title || '') }} aria-label="Rename list" data-tooltip="Rename list">
              <Pencil aria-hidden="true" size={16} strokeWidth={2} />
            </button>
          )}
          <button className="list__icon" type="button" onClick={onDeleteList} aria-label="Delete list" data-tooltip="Delete list">
            <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="list__composer">
          <input
            className="list__input"
            type="text"
            placeholder="Add a new item..."
            value={newItemText}
            onChange={(event) => setNewItemText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAdd()
              }
            }}
          />
          <button
            className="list__icon"
            type="button"
            onClick={handleAdd}
            disabled={!newItemText.trim()}
            aria-label="Add item"
            data-tooltip="Add item"
          >
            <Plus aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        </div>
      </header>
      <ul className="list__items">
        {listItems.length > 0 && (
          <>
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <SortableContext
                items={incompleteItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {incompleteItems.map((item) => (
                  <SortableListItem
                    key={item.id}
                    item={item}
                    isEditing={editingItemId === item.id}
                    editDraft={editingItemDraft}
                    onStartEdit={() => beginEditItem(item)}
                    onEditDraftChange={setEditingItemDraft}
                    onSaveEdit={() => saveEditItem(activeList.id, item.id)}
                    onCancelEdit={cancelEditItem}
                    onToggle={() => onToggleItem(activeList.id, item.id)}
                    onDelete={() => onDeleteItem(activeList.id, item.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {completedItems.map((item) => (
              <li
                key={item.id}
                data-item-id={item.id}
                className="list-item is-complete"
              >
                <ListItemContent
                  item={item}
                  isEditing={editingItemId === item.id}
                  editDraft={editingItemDraft}
                  onStartEdit={() => beginEditItem(item)}
                  onEditDraftChange={setEditingItemDraft}
                  onSaveEdit={() => saveEditItem(activeList.id, item.id)}
                  onCancelEdit={cancelEditItem}
                  onToggle={() => onToggleItem(activeList.id, item.id)}
                  onDelete={() => onDeleteItem(activeList.id, item.id)}
                />
              </li>
            ))}
          </>
        )}
        {!listItems.length && (
          <li className="list-item list-item--empty">
            No items yet. Add the first task above.
          </li>
        )}
      </ul>
    </article>
  )
}
