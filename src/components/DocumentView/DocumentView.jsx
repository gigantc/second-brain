import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Bold, Heading1, Heading2, List, ListChecks, ListOrdered, Link as LinkIcon, Pencil, Save, Trash2, X } from 'lucide-react'
import { markdownToInitialHtml, richTextExtensions } from '../../utils/richText'
import './DocumentView.scss'

export default function DocumentView({
  activeDoc,
  briefGreeting,
  user,
  onSave,
  onDelete,
}) {
  const editable = user && !activeDoc.isBrief
  const [isEditing, setIsEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [tagsDraft, setTagsDraft] = useState('')

  const initialContent = useMemo(() => {
    if (activeDoc.contentJson) return activeDoc.contentJson
    return markdownToInitialHtml(activeDoc.content || '')
  }, [activeDoc.contentJson, activeDoc.content])

  const editor = useEditor({
    extensions: richTextExtensions,
    content: initialContent,
    editable: isEditing,
    immediatelyRender: false,
  })

  useEffect(() => {
    setIsEditing(false)
    setTitleDraft(activeDoc.title || '')
    setTagsDraft((activeDoc.rawTags || activeDoc.tags || []).join(', '))

    if (editor) {
      editor.setEditable(false)
      editor.commands.setContent(activeDoc.contentJson || markdownToInitialHtml(activeDoc.content || ''), false)
    }
  }, [activeDoc.id, activeDoc.title, activeDoc.content, activeDoc.contentJson, activeDoc.rawTags, activeDoc.tags, editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(isEditing)
  }, [editor, isEditing])

  const saveNote = async () => {
    if (!editor) return
    const tags = tagsDraft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    await onSave(activeDoc, {
      title: titleDraft,
      tags,
      contentJson: editor.getJSON(),
      content: editor.getText(),
    })
    setIsEditing(false)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setTitleDraft(activeDoc.title || '')
    setTagsDraft((activeDoc.rawTags || activeDoc.tags || []).join(', '))
    if (editor) editor.commands.setContent(activeDoc.contentJson || markdownToInitialHtml(activeDoc.content || ''), false)
  }

  const tool = (label, action, active = false, icon = null) => (
    <button className={`doc__icon ${active ? 'is-active' : ''}`} type="button" onClick={action} aria-label={label} title={label}>
      {icon}
    </button>
  )

  return (
    <article className="doc">
      <header className="doc__header">
        <div className="doc__title">
          <h1>{briefGreeting || activeDoc.title}</h1>
          {activeDoc.isBrief && <div className="doc__date">{activeDoc.title}</div>}
          {!activeDoc.isBrief && activeDoc.created && <div className="doc__date">{activeDoc.created}</div>}
          {!activeDoc.isBrief && (
            <div className="doc__kind">{activeDoc.isJournal ? 'Journal' : 'Note'}</div>
          )}
          {activeDoc.tags.length > 0 && !isEditing && (
            <div className="doc__tags">
              {activeDoc.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
            </div>
          )}
        </div>

        {user && (
          <div className="doc__panel">
            {editable && !isEditing && tool('Edit note', () => setIsEditing(true), false, <Pencil aria-hidden="true" size={16} />)}
            {editable && isEditing && (
              <>
                {tool('Save note', saveNote, false, <Save aria-hidden="true" size={16} />)}
                {tool('Cancel edit', cancelEdit, false, <X aria-hidden="true" size={16} />)}
              </>
            )}
            {tool(activeDoc.isBrief ? 'Delete brief' : 'Delete note', () => onDelete(activeDoc), false, <Trash2 aria-hidden="true" size={16} />)}
          </div>
        )}
      </header>

      {isEditing && editable && (
        <div className="doc__editor-meta">
          <label className="doc__label">Title</label>
          <input className="doc__input" type="text" value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
          <label className="doc__label">Tags</label>
          <input className="doc__input" type="text" value={tagsDraft} onChange={(event) => setTagsDraft(event.target.value)} placeholder="work, ideas" />

          {editor && (
            <div className="doc__toolbar">
              {tool('Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), <Bold aria-hidden="true" size={14} />)}
              {tool('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), <Heading1 aria-hidden="true" size={14} />)}
              {tool('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), <Heading2 aria-hidden="true" size={14} />)}
              {tool('Bullet list', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), <List aria-hidden="true" size={14} />)}
              {tool('Numbered list', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), <ListOrdered aria-hidden="true" size={14} />)}
              {tool('Checklist', () => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList'), <ListChecks aria-hidden="true" size={14} />)}
              {tool('Link', () => {
                const url = window.prompt('Enter URL')
                if (url) editor.chain().focus().setLink({ href: url }).run()
              }, editor.isActive('link'), <LinkIcon aria-hidden="true" size={14} />)}
            </div>
          )}
        </div>
      )}

      <div className={`doc__content ${isEditing ? 'is-editing' : ''}`}>
        <EditorContent editor={editor} />
      </div>

    </article>
  )
}
