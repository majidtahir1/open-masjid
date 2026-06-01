import type { CSSProperties, ReactNode, SVGProps } from 'react'
import { ArrowUp, Check, GitCompare } from './Icons'

/* OpenMasjid Ansari chat mockup components.
   Channel-agnostic, generic messaging UI. Pure presentational (no client
   state), so these render fine as server components. Ported from the
   Claude Design handoff (assistant/Chat.jsx). */

type IconCmp = (p: SVGProps<SVGSVGElement>) => ReactNode

function Avatar({ dark = false }: { dark?: boolean }) {
  return (
    <span className="oa-avatar" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 40 40">
        <path d="M8 32 V18 C8 12.5 13.4 8 20 8 C26.6 8 32 12.5 32 18 V32 Z" fill="white" />
        <path d="M16 32 V19 C16 17 17.8 15.5 20 15.5 C22.2 15.5 24 17 24 19 V32 Z" fill={dark ? '#114751' : '#0F1E4A'} />
      </svg>
    </span>
  )
}

function ChatHead({ dark = false }: { dark?: boolean }) {
  return (
    <div className="oa-chat-head">
      <Avatar dark={dark} />
      <div>
        <p className="oa-chat-head-name">OpenMasjid Ansari</p>
        <p className="oa-chat-head-status">Online · replies in seconds</p>
      </div>
    </div>
  )
}

/* outgoing (admin) bubble */
export function ChatOut({ children }: { children: ReactNode }) {
  return <div className="oa-msg out">{children}</div>
}
/* incoming (assistant) bubble */
export function ChatIn({ children }: { children: ReactNode }) {
  return <div className="oa-msg in">{children}</div>
}

export function ChatTime({ children }: { children: ReactNode }) {
  return <div className="oa-msg-time">{children}</div>
}

export function ChatTyping() {
  return (
    <div className="oa-typing">
      <span /><span /><span />
    </div>
  )
}

export function ChatDone({ children }: { children: ReactNode }) {
  return (
    <div className="oa-done">
      <Check width={15} height={15} /> {children}
    </div>
  )
}

/* a "card" the assistant renders, used for diff-then-confirm */
export function ChatCard({ label, Icon = GitCompare, children }: { label: string; Icon?: IconCmp; children: ReactNode }) {
  return (
    <div className="oa-card-msg">
      <p className="oa-card-msg-label"><Icon width={13} height={13} /> {label}</p>
      {children}
    </div>
  )
}

export function DiffRow({ k, oldVal, newVal }: { k: string; oldVal?: string; newVal: string }) {
  return (
    <div className="oa-diff-row">
      <span className="oa-diff-key">{k}</span>
      {oldVal && (
        <>
          <span className="oa-diff-old">{oldVal}</span>
          <span className="oa-diff-arrow">→</span>
        </>
      )}
      <span className="oa-diff-new">{newVal}</span>
    </div>
  )
}

export function Confirm({ yes = 'Yes, apply', no = 'Edit' }: { yes?: string; no?: string }) {
  return (
    <div className="oa-confirm">
      <span className="oa-chip primary"><Check width={14} height={14} /> {yes}</span>
      <span className="oa-chip ghost">{no}</span>
    </div>
  )
}

/* forwarded image attachment chip (inside an outgoing bubble) */
export function Attach({ label = 'flyer.jpg', meta = '1.2 MB · image' }: { label?: string; meta?: string }) {
  return (
    <div className="oa-attach">
      <span className="oa-attach-thumb" style={{ background: 'linear-gradient(135deg, #D9A84E, #9A7428)' }} />
      <span className="oa-attach-meta">
        <b>{label}</b>
        {meta}
      </span>
    </div>
  )
}

function InputBar({ placeholder = 'Message Ansari…' }: { placeholder?: string }) {
  return (
    <div className="oa-chat-input">
      <span className="oa-chat-input-field">{placeholder}</span>
      <span className="oa-chat-send"><ArrowUp width={18} height={18} /></span>
    </div>
  )
}

/* Full chat panel: head + body(children) + optional input bar */
export function AnsariChat({
  dark = false,
  input = true,
  children,
  style,
}: {
  dark?: boolean
  input?: boolean
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className={`oa-chat ${dark ? 'is-dark' : ''}`} style={style}>
      <ChatHead dark={dark} />
      <div className="oa-chat-body">{children}</div>
      {input && <InputBar />}
    </div>
  )
}
