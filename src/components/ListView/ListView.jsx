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
import { Pencil, Save, Trash2, X } from 'lucide-react'
import SortableListItem from './SortableListItem'
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
            <div className="list__title-edit">
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
              />
              <button
                className="list__rename-save"
                type="button"
                onClick={handleRename}
                aria-label="Save list name"
                title="Save"
              >
                <Save aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              <button
                className="list__rename-cancel"
                type="button"
                onClick={() => {
                  setIsEditingListTitle(false)
                  setListTitleDraft(activeList.title || '')
                }}
                aria-label="Cancel rename"
                title="Cancel"
              >
                <X aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="list__title-display">
              <h1>{activeList.title}</h1>
              <button
                className="list__rename"
                type="button"
                onClick={() => {
                  setIsEditingListTitle(true)
                  setListTitleDraft(activeList.title || '')
                }}
                aria-label="Rename list"
                title="Rename list"
              >
                <Pencil aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </div>
          )}
          <div className="list__meta">
            {listStats?.completed ?? 0} of {listStats?.total ?? 0} done
          </div>
        </div>
        <button
          className="list__delete"
          type="button"
          onClick={onDeleteList}
          aria-label="Delete list"
          title="Delete list"
        >
          <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
        </button>
      </header>
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
          className="list__add-button"
          type="button"
          onClick={handleAdd}
          disabled={!newItemText.trim()}
        >
          Add
        </button>
      </div>
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
                <span className="list-item__swipe" aria-hidden="true" />
                <button
                  className="list-item__checkbox"
                  type="button"
                  onClick={() => onToggleItem(activeList.id, item.id)}
                  aria-pressed={item.completed}
                >
                  <span className="list-item__check" />
                </button>

                {editingItemId === item.id ? (
                  <div className="list-item__edit-wrap">
                    <input
                      className="list-item__edit-input"
                      type="text"
                      value={editingItemDraft}
                      onChange={(event) => setEditingItemDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          saveEditItem(activeList.id, item.id)
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelEditItem()
                        }
                      }}
                      autoFocus
                    />
                    <button className="list-item__action" type="button" onClick={() => saveEditItem(activeList.id, item.id)} aria-label="Save item" title="Save">
                      <Save aria-hidden="true" size={14} strokeWidth={2} />
                    </button>
                    <button className="list-item__action" type="button" onClick={cancelEditItem} aria-label="Cancel edit" title="Cancel">
                      <X aria-hidden="true" size={14} strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="list-item__text">{item.text}</span>
                    <button
                      className="list-item__action"
                      type="button"
                      onClick={() => beginEditItem(item)}
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
                  onClick={() => onDeleteItem(activeList.id, item.id)}
                  aria-label="Delete item"
                  title="Delete item"
                >
                  <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
                </button>
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
