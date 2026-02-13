import DocumentView from '../DocumentView/DocumentView'
import ListView from '../ListView/ListView'
import './Viewer.scss'

export default function Viewer({
  activeList,
  activeDoc,
  listStats,
  briefGreeting,
  user,
  autoEditDocId,
  onSaveDoc,
  onDiscardNewDoc,
  onDeleteDoc,
  onAddListItem,
  onToggleListItem,
  onDeleteListItem,
  onEditListItem,
  onDeleteList,
  onRenameList,
  onDragEnd,
}) {
  if (activeList) {
    return (
      <main className="viewer">
        <ListView
          activeList={activeList}
          listStats={listStats}
          onAddItem={onAddListItem}
          onToggleItem={onToggleListItem}
          onDeleteItem={onDeleteListItem}
          onEditItem={onEditListItem}
          onDeleteList={onDeleteList}
          onRenameList={onRenameList}
          onDragEnd={onDragEnd}
        />
      </main>
    )
  }

  if (activeDoc) {
    return (
      <main className="viewer">
        <DocumentView
          activeDoc={activeDoc}
          briefGreeting={briefGreeting}
          user={user}
          onSave={onSaveDoc}
          onDiscardNew={onDiscardNewDoc}
          onDelete={onDeleteDoc}
          autoStartEdit={autoEditDocId === activeDoc?.id}
        />
      </main>
    )
  }

  return (
    <main className="viewer">
      <div className="empty">
        Select a note from the left to get started.
      </div>
    </main>
  )
}
