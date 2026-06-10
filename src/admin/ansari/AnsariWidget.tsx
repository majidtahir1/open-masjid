'use client'

import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import styles from './AnsariWidget.module.css'
import { parseSseContentDelta } from '@/lib/ansari'

type Msg = { role: 'user' | 'assistant'; content: string }
type View = 'closed' | 'docked' | 'expanded'

export default function AnsariWidget() {
  const [allowed, setAllowed] = useState(false)
  const [view, setView] = useState<View>('closed')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [tool, setTool] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Self-gate: only render the launcher for tenant admins.
  useEffect(() => {
    let on = true
    fetch('/api/users/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (on && d?.user?.role === 'admin') setAllowed(true)
      })
      .catch(() => {})
    return () => {
      on = false
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, tool])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setError(null)
    setInput('')
    const history: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setBusy(true)

    try {
      const res = await fetch('/admin/api/ansari/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) throw new Error(`relay ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistant = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const raw of lines) {
          const line = raw.trimStart()
          const delta = parseSseContentDelta(line)
          if (delta) {
            setTool(null)
            assistant += delta
            setMessages([...history, { role: 'assistant', content: assistant }])
            continue
          }
          // Best-effort tool-progress chip (Hermes-specific; payload shape
          // unverified — confirm against the live stream in Task 5a).
          if (line.startsWith('data:')) {
            const payload = line.slice('data:'.length).trim()
            if (payload && payload !== '[DONE]') {
              try {
                const progress = (
                  JSON.parse(payload) as { hermes?: { tool?: { progress?: string } } }
                ).hermes?.tool?.progress
                if (typeof progress === 'string') setTool(progress)
              } catch {
                // ignore keepalive / non-JSON lines
              }
            }
          }
        }
      }
    } catch {
      setError('Ansari is unreachable right now. Try again in a moment.')
      setMessages(history)
    } finally {
      setBusy(false)
      setTool(null)
    }
  }

  if (!allowed) return null

  if (view === 'closed') {
    return (
      <button
        className={styles.launcher}
        onClick={() => setView('docked')}
        title="Chat with Ansari"
        aria-label="Chat with Ansari"
      >
        <span className={styles.dot} />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </button>
    )
  }

  const expanded = view === 'expanded'

  return (
    <>
      {expanded && <div className={styles.backdrop} onClick={() => setView('docked')} />}
      <section className={expanded ? `${styles.panel} ${styles.expanded}` : styles.panel}>
        <header className={styles.hdr}>
          <div className={styles.avatar}>A</div>
          <div className={styles.meta}>
            <div className={styles.name}>Ansari</div>
            <div className={styles.status}>Online</div>
          </div>
          <button
            onClick={() => {
              setMessages([])
              setError(null)
              setTool(null)
            }}
            disabled={busy || messages.length === 0}
            title="New chat"
            aria-label="Start a new chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
          <button onClick={() => setView(expanded ? 'docked' : 'expanded')} title={expanded ? 'Restore' : 'Expand'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          </button>
          <button onClick={() => setView('closed')} title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className={styles.msgs} ref={scrollRef}>
          {messages.length === 0 && (
            <div className={`${styles.row} ${styles.bot}`}>
              <div className={styles.bubble}>
                Assalamu alaikum 👋 I'm Ansari. Ask me to update prayer times, post an
                announcement, manage events, or build a signup form.
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`${styles.row} ${m.role === 'user' ? styles.user : styles.bot}`}>
              <div className={styles.bubble}>
                {m.role === 'assistant' ? (
                  <ReactMarkdown>{m.content || '…'}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {tool && (
            <div className={styles.tool}>
              <span className={styles.spin} /> {tool}
            </div>
          )}
          {busy && !tool && (
            <div className={`${styles.row} ${styles.bot}`}>
              <div className={styles.typing}><span /><span /><span /></div>
            </div>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <button type="button" className={styles.attach} disabled title="Flyer upload — coming soon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <textarea
            className={styles.textarea}
            rows={1}
            placeholder="Message Ansari…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            disabled={busy}
          />
          <button type="submit" className={styles.send} disabled={busy || input.trim() === ''} title="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </form>
      </section>
    </>
  )
}
