import { memo } from 'react'
import Outline from './Outline'
import Metadata from './Metadata'
import BriefCompare from './BriefCompare'
import Related from './Related'
import Backlinks from './Backlinks'
import ListStats from './ListStats'
import './Rightbar.scss'

export default memo(function Rightbar({
  activeList,
  activeDoc,
  listStats,
  outline,
  docStats,
  briefCompare,
  relatedDocs,
  backlinks,
  snippetMap,
  onNavigate,
}) {
  return (
    <aside className="rightbar">
      <div className="rightbar__content">
        {activeList ? (
          <ListStats listStats={listStats} activeList={activeList} />
        ) : (
          <>
            <Outline outline={outline} activeDoc={activeDoc} />
            <Metadata docStats={docStats} activeDoc={activeDoc} />
            <BriefCompare briefCompare={briefCompare} />
            <Related relatedDocs={relatedDocs} onNavigate={onNavigate} />
            <Backlinks backlinks={backlinks} snippetMap={snippetMap} onNavigate={onNavigate} />
          </>
        )}
      </div>
    </aside>
  )
})
