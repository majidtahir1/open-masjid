'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------ themes */

interface Theme {
  screenBg: string
  ink: string
  sub: string
  faint: string
  cardLine: string
  card: string
  chipBg: string
  brand: string
  brandText: string
  brandSoft: string
  eyebrow: string
  good: string
  goodSoft: string
  warn: string
  warnText: string
  danger: string
  dangerSoft: string
  keyBg: string
  keyColor: string
  keyLine: string
  btnShadow: string
  toastVeil: string
  toastCard: string
  watermark: boolean
}

const THEMES: Record<'day' | 'focus', Theme> = {
  day: {
    screenBg: 'radial-gradient(125% 105% at 50% -12%, #FFFDF8 0%, #F2F0E7 58%, #EAE7DB 100%)',
    ink: '#0F1E4A', sub: '#5A6064', faint: '#9DA09D', cardLine: '#E9E5DA', card: '#FFFFFF',
    chipBg: '#FFFFFF', brand: '#1E7E8E', brandText: '#FFFFFF', brandSoft: '#E9F5F6',
    eyebrow: '#1E7E8E', good: '#2E8B57', goodSoft: '#E4F2E9', warn: '#B8954F', warnText: '#FFFFFF',
    danger: '#A8463A', dangerSoft: '#F6E7E3', keyBg: '#FFFFFF', keyColor: '#0F1E4A', keyLine: '#E5E1D5',
    btnShadow: '0 8px 22px rgba(30,126,142,.28)', toastVeil: 'rgba(15,30,74,.28)', toastCard: '#FFFFFF',
    watermark: false,
  },
  focus: {
    screenBg: 'linear-gradient(180deg, #142A66 0%, #0F1E4A 58%, #0A1638 100%)',
    ink: '#FFFFFF', sub: '#B6C0E0', faint: '#7E89BC', cardLine: 'rgba(255,255,255,.13)', card: 'rgba(255,255,255,.06)',
    chipBg: 'rgba(255,255,255,.07)', brand: '#28A0B4', brandText: '#04222A', brandSoft: 'rgba(40,160,180,.15)',
    eyebrow: '#5CB8C3', good: '#5FD3A4', goodSoft: 'rgba(95,211,164,.15)', warn: '#F0C88C', warnText: '#231A06',
    danger: '#F0A89A', dangerSoft: 'rgba(240,168,154,.13)', keyBg: 'rgba(255,255,255,.07)', keyColor: '#FFFFFF', keyLine: 'rgba(255,255,255,.13)',
    btnShadow: '0 8px 22px rgba(40,160,180,.30)', toastVeil: 'rgba(6,12,30,.6)', toastCard: '#152760',
    watermark: false,
  },
}

const FR = "var(--font-fraunces), Georgia, serif"
const IN = "var(--font-inter), system-ui, sans-serif"

/* ------------------------------------------------------------------- types */

type ChildStatus = 'none' | 'in' | 'out'
interface Child {
  id: string
  name: string
  firstName: string
  grade: string | null
  classes: string[]
  hasToday: boolean
  status: ChildStatus
  checkInAt: string | null
  checkOutAt: string | null
}
interface ProgramOpt {
  id: string
  name: string
  meetingDays: string[]
}

const LS = { token: 'checkin:token', program: 'checkin:programName', tenant: 'checkin:tenantName', theme: 'checkin:theme' }

/* --------------------------------------------------------------- utilities */

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const ap = h < 12 ? 'AM' : 'PM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}
function fmtPhone(raw: string): string {
  const tpl = '(###) ###-####'
  let i = 0, s = ''
  for (const ch of tpl) {
    if (ch === '#') { s += i < raw.length ? raw[i] : '·'; i++ } else s += ch
  }
  return s
}
const todayStr = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

/* ------------------------------------------------------------------- icons */

const Arrow = ({ s = 28 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
)
const Check = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
)
const OutIcon = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
)
const Back = () => (
  <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
)

/* ============================================================== component */

export default function CheckinKiosk() {
  const [ready, setReady] = useState(false)
  const [bound, setBound] = useState(false)
  const [theme, setTheme] = useState<'day' | 'focus'>('day')
  const t = THEMES[theme]

  // kiosk identity
  const [token, setToken] = useState<string | null>(null)
  const [programName, setProgramName] = useState('Program')
  const [tenantName, setTenantName] = useState('Masjid')

  // load persisted binding (client-only; localStorage is unavailable during SSR)
  useEffect(() => {
    try {
      const tok = localStorage.getItem(LS.token)
      const th = localStorage.getItem(LS.theme)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (th === 'focus' || th === 'day') setTheme(th)
      if (tok) {
        setToken(tok)
        setProgramName(localStorage.getItem(LS.program) || 'Program')
        setTenantName(localStorage.getItem(LS.tenant) || 'Masjid')
        setBound(true)
      }
    } catch { /* no storage */ }
    setReady(true)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'day' ? 'focus' : 'day'
      try { localStorage.setItem(LS.theme, next) } catch { /* */ }
      return next
    })
  }, [])

  const unbind = useCallback(() => {
    try {
      localStorage.removeItem(LS.token)
      localStorage.removeItem(LS.program)
      localStorage.removeItem(LS.tenant)
    } catch { /* */ }
    setToken(null)
    setBound(false)
  }, [])

  if (!ready) return <div style={{ width: '100vw', height: '100vh', background: t.screenBg }} />

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: IN, background: t.screenBg }}>
      <style>{`
        @keyframes scrFade{from{opacity:0;transform:scale(.992)}to{opacity:1;transform:scale(1)}}
        @keyframes toastIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes ringPop{0%{transform:scale(.4);opacity:0}55%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
      `}</style>
      {bound && token ? (
        <Kiosk
          t={t} theme={theme} toggleTheme={toggleTheme} onUnbind={unbind}
          token={token} programName={programName} tenantName={tenantName}
        />
      ) : (
        <StaffSetup
          t={t}
          onBound={(tok, prog, ten) => {
            setToken(tok)
            try {
              localStorage.setItem(LS.token, tok)
              localStorage.setItem(LS.program, prog)
              localStorage.setItem(LS.tenant, ten)
            } catch { /* */ }
            setProgramName(prog); setTenantName(ten); setBound(true)
          }}
        />
      )}
    </div>
  )
}

/* ============================================================ kiosk screens */

function Kiosk({
  t, theme, toggleTheme, onUnbind, token, programName, tenantName,
}: {
  t: Theme; theme: 'day' | 'focus'; toggleTheme: () => void; onUnbind: () => void
  token: string; programName: string; tenantName: string
}) {
  // Discreet staff escape hatch: long-press (1.5s) the masjid name on the idle
  // screen to clear this device's binding and return to Staff setup.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startHold = () => { holdTimer.current = setTimeout(onUnbind, 1500) }
  const cancelHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current) }
  const [screen, setScreen] = useState<'idle' | 'phone' | 'children'>('idle')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [familyName, setFamilyName] = useState('')
  const [kids, setKids] = useState<Child[]>([])
  const [toast, setToast] = useState<{ name: string; kind: 'in' | 'out' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goIdle = useCallback(() => {
    setScreen('idle'); setPhone(''); setPhoneError(false); setKids([]); setFamilyName('')
  }, [])

  // Fullscreen can only be requested from a user gesture, so we trigger it on
  // the first tap (leaving the idle screen) rather than on load. Best-effort —
  // iPads locked via Guided Access / Add-to-Home-Screen are already fullscreen.
  const beginFromIdle = () => {
    try {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
      if (!document.fullscreenElement) {
        const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el)
        void req?.()?.catch?.(() => {})
      }
    } catch { /* unsupported */ }
    setScreen('phone')
  }

  // inactivity → return to idle
  useEffect(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (screen !== 'idle') idleTimer.current = setTimeout(goIdle, 30_000)
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [screen, kids, phone, toast, goIdle])

  const showToast = (name: string, kind: 'in' | 'out') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ name, kind })
    toastTimer.current = setTimeout(() => setToast(null), 2300)
  }

  async function api(path: string, body: unknown) {
    const res = await fetch(`/api/checkin/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  const onContinue = async () => {
    if (phone.length !== 10 || busy) return
    setBusy(true); setPhoneError(false)
    try {
      const r = await api('lookup', { phone })
      if (r.found) { setFamilyName(r.familyName); setKids(r.children); setScreen('children') }
      else setPhoneError(true)
    } catch { setPhoneError(true) } finally { setBusy(false) }
  }

  const applyResult = (id: string, r: { status: ChildStatus; checkInAt: string | null; checkOutAt: string | null }) =>
    setKids((ks) => ks.map((k) => (k.id === id ? { ...k, status: r.status, checkInAt: r.checkInAt, checkOutAt: r.checkOutAt } : k)))

  const doCheck = (kid: Child, action: 'in' | 'out') => async () => {
    if (busy) return
    setBusy(true)
    // optimistic
    const now = new Date().toISOString()
    applyResult(kid.id, action === 'in'
      ? { status: 'in', checkInAt: now, checkOutAt: null }
      : { status: 'out', checkInAt: kid.checkInAt, checkOutAt: now })
    showToast(kid.firstName, action)
    try {
      const r = await api('check', { studentId: kid.id, action })
      if (r.ok) applyResult(kid.id, r)
    } catch { /* keep optimistic */ } finally { setBusy(false) }
  }

  const checkable = kids.filter((k) => k.hasToday && k.status !== 'in')
  const checkAll = async () => {
    if (busy || !checkable.length) return
    setBusy(true)
    showToast(`${checkable.length} children`, 'in')
    for (const kid of checkable) {
      try { const r = await api('check', { studentId: kid.id, action: 'in' }); if (r.ok) applyResult(kid.id, r) } catch { /* */ }
    }
    setBusy(false)
  }

  /* ---- idle ---- */
  if (screen === 'idle')
    return (
      <Screen>
        <div onClick={beginFromIdle} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer', position: 'relative', animation: 'scrFade .32s cubic-bezier(.22,.61,.36,1)' }}>
          <div style={{ padding: 'clamp(28px,5vh,52px) clamp(28px,5vw,60px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              title="Hold to change kiosk settings"
              style={{ fontFamily: FR, fontWeight: 500, fontSize: 26, color: t.ink, userSelect: 'none', cursor: 'default' }}
            >{tenantName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ fontSize: 15, color: t.faint, fontWeight: 500 }}>{todayStr()}</div>
              <div
                onClick={(e) => { e.stopPropagation(); toggleTheme() }}
                title="Switch appearance"
                style={{ width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: t.chipBg, border: `1px solid ${t.cardLine}`, color: t.sub }}
              >
                {theme === 'day' ? (
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                ) : (
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
                )}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 60px', marginTop: -30 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: t.eyebrow }}>{tenantName}</div>
            <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 'clamp(48px,9vw,88px)', letterSpacing: '-.02em', color: t.ink, lineHeight: 1.04, marginTop: 14 }}>{programName}</div>
            <div style={{ fontSize: 'clamp(18px,2.6vw,24px)', color: t.sub, marginTop: 18 }}>Drop-off &amp; pickup — check your child in or out.</div>
            <div style={{ marginTop: 50, display: 'inline-flex', alignItems: 'center', gap: 14, height: 84, padding: '0 46px', borderRadius: 999, background: t.brand, color: t.brandText, fontSize: 26, fontWeight: 600, boxShadow: t.btnShadow }}>
              Tap anywhere to begin <Arrow />
            </div>
          </div>
          <div style={{ height: 38 }} />
        </div>
      </Screen>
    )

  /* ---- phone ---- */
  if (screen === 'phone') {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', '⌫']
    const press = (k: string) => () => {
      setPhoneError(false)
      if (k === 'Clear') setPhone('')
      else if (k === '⌫') setPhone((p) => p.slice(0, -1))
      else setPhone((p) => (p.length < 10 ? p + k : p))
    }
    const can = phone.length === 10
    return (
      <Screen>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', animation: 'scrFade .32s cubic-bezier(.22,.61,.36,1)' }}>
          <div style={{ padding: '34px clamp(28px,5vw,48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div onClick={goIdle} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 18px', borderRadius: 12, background: t.chipBg, border: `1px solid ${t.cardLine}`, color: t.sub, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}><Back />Cancel</div>
            <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 20, color: t.ink }}>{tenantName}</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 16px 24px' }}>
            <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 'clamp(26px,4.4vw,42px)', color: t.ink, textAlign: 'center' }}>Enter your phone number</div>
            <div style={{ fontSize: 'clamp(15px,2vh,18px)', color: t.sub, marginTop: 8, textAlign: 'center' }}>We&apos;ll find your family — only your own children appear.</div>
            <div style={{ marginTop: 'clamp(10px,2vh,24px)', fontFamily: IN, fontSize: 'clamp(34px,6vh,52px)', fontWeight: 600, letterSpacing: '.04em', color: phone.length ? t.ink : t.faint, minHeight: 'clamp(42px,7vh,62px)' }}>{fmtPhone(phone)}</div>
            <div style={{ marginTop: 'clamp(8px,1.6vh,18px)', display: 'grid', gridTemplateColumns: 'repeat(3, clamp(82px,11vw,112px))', gap: 'clamp(8px,1.4vh,14px)' }}>
              {keys.map((k) => {
                const act = k === 'Clear' || k === '⌫'
                return (
                  <div key={k} onClick={press(k)} style={{ height: 'clamp(54px,8.5vh,80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: act ? 22 : 30, fontWeight: 600, borderRadius: 18, cursor: 'pointer', userSelect: 'none', background: act ? 'transparent' : t.keyBg, color: act ? t.faint : t.keyColor, border: `1px solid ${act ? 'transparent' : t.keyLine}` }}>{k}</div>
                )
              })}
            </div>
            {phoneError && (
              <div style={{ marginTop: 'clamp(12px,2vh,22px)', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 20px', borderRadius: 12, background: t.dangerSoft, color: t.danger, fontSize: 16, fontWeight: 500, maxWidth: 560, textAlign: 'center' }}>
                No family found with that number. Check with a volunteer, or try again.
              </div>
            )}
            <div onClick={onContinue} style={{ marginTop: 'clamp(12px,2vh,22px)', display: 'inline-flex', alignItems: 'center', gap: 12, height: 'clamp(54px,7.5vh,68px)', padding: '0 42px', borderRadius: 16, fontSize: 21, fontWeight: 600, cursor: can ? 'pointer' : 'default', background: can ? t.brand : t.chipBg, color: can ? t.brandText : t.faint, opacity: can ? 1 : 0.6 }}>
              {busy ? 'Checking…' : 'Continue'} <Arrow s={22} />
            </div>
          </div>
        </div>
      </Screen>
    )
  }

  /* ---- children ---- */
  return (
    <Screen>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', animation: 'scrFade .32s cubic-bezier(.22,.61,.36,1)' }}>
        <div style={{ padding: '30px clamp(28px,5vw,44px) 22px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: `1px solid ${t.cardLine}` }}>
          <div>
            <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', color: t.ink, letterSpacing: '-.01em' }}>Salam, {familyName}</div>
            <div style={{ fontSize: 16, color: t.sub, marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>{programName}<span style={{ color: t.faint }}>·</span><span style={{ color: t.faint }}>{fmtTime(new Date().toISOString())}</span></div>
          </div>
          <div onClick={goIdle} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 24px', borderRadius: 12, background: t.chipBg, border: `1px solid ${t.cardLine}`, color: t.sub, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Done</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px clamp(28px,5vw,44px) 30px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ flex: 1, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {checkable.length >= 2 && (
              <div onClick={checkAll} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, height: 58, borderRadius: 14, border: `1.5px dashed ${t.brand}`, color: t.brand, fontSize: 17, fontWeight: 600, cursor: 'pointer', background: t.brandSoft }}>
                <Check />Check in all ({checkable.length})
              </div>
            )}

            {kids.map((kid) => {
              const meta = [kid.grade, kid.classes.join(', ')].filter(Boolean).join(' · ')
              const pill = !kid.hasToday
                ? { text: 'No class today', color: t.faint, bg: t.chipBg, dot: '—' }
                : kid.status === 'none'
                ? { text: 'Not yet arrived', color: t.faint, bg: t.chipBg, dot: '○' }
                : kid.status === 'in'
                ? { text: `Checked in ${fmtTime(kid.checkInAt)}`, color: t.good, bg: t.goodSoft, dot: '●' }
                : { text: `Checked out ${fmtTime(kid.checkOutAt)}`, color: t.sub, bg: t.chipBg, dot: '◌' }
              const btn =
                kid.status === 'in'
                  ? { label: 'Check out', bg: t.warn, color: t.warnText, border: 'none', shadow: 'none', action: 'out' as const, Icon: OutIcon }
                  : kid.status === 'out'
                  ? { label: 'Check in again', bg: 'transparent', color: t.brand, border: `1.5px solid ${t.brand}`, shadow: 'none', action: 'in' as const, Icon: Check }
                  : { label: 'Check in', bg: t.brand, color: t.brandText, border: 'none', shadow: t.btnShadow, action: 'in' as const, Icon: Check }
              return (
                <div key={kid.id} style={{ background: t.card, border: `1px solid ${t.cardLine}`, borderRadius: 18, padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 22, boxShadow: theme === 'day' ? '0 2px 8px rgba(19,46,48,.05)' : 'none', opacity: kid.hasToday ? 1 : 0.7 }}>
                  <div style={{ flex: 'none', width: 62, height: 62, borderRadius: '50%', background: t.brandSoft, color: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FR, fontWeight: 500, fontSize: 26 }}>{kid.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 30, color: t.ink, letterSpacing: '-.01em' }}>{kid.name}</div>
                    {meta && <div style={{ fontSize: 15, color: t.sub, marginTop: 4 }}>{meta}</div>}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 13, padding: '6px 13px', borderRadius: 999, background: pill.bg, color: pill.color, fontSize: 14.5, fontWeight: 600 }}>
                      <span style={{ fontSize: 11 }}>{pill.dot}</span>{pill.text}
                    </div>
                  </div>
                  {kid.hasToday ? (
                    <div onClick={doCheck(kid, btn.action)} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, minWidth: 200, height: 66, padding: '0 28px', borderRadius: 14, fontSize: 19, fontWeight: 600, cursor: 'pointer', background: btn.bg, color: btn.color, border: btn.border, boxShadow: btn.shadow }}>
                      <btn.Icon />{btn.label}
                    </div>
                  ) : (
                    <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 200, height: 66, padding: '0 28px', borderRadius: 14, fontSize: 15, fontWeight: 500, color: t.faint, border: `1px dashed ${t.cardLine}` }}>No class today</div>
                  )}
                </div>
              )
            })}
            <div style={{ textAlign: 'center', fontSize: 13.5, color: t.faint, marginTop: 6 }}>Returns to the welcome screen automatically after a short pause.</div>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'absolute', inset: 0, background: t.toastVeil, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ background: t.toastCard, border: `1px solid ${t.cardLine}`, borderRadius: 26, padding: '46px 60px', textAlign: 'center', boxShadow: '0 30px 80px rgba(8,16,28,.4)', animation: 'toastIn .34s cubic-bezier(.22,.61,.36,1)', minWidth: 440 }}>
            <div style={{ width: 104, height: 104, borderRadius: '50%', background: toast.kind === 'in' ? t.goodSoft : t.chipBg, color: toast.kind === 'in' ? t.good : t.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', animation: 'ringPop .5s cubic-bezier(.22,.61,.36,1)' }}>
              {toast.kind === 'in' ? <Check s={52} /> : <OutIcon s={52} />}
            </div>
            <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 38, color: t.ink, marginTop: 24 }}>{toast.name}</div>
            <div style={{ fontSize: 20, color: t.sub, marginTop: 8 }}>{toast.kind === 'in' ? 'Checked in' : 'Checked out'} · {fmtTime(new Date().toISOString())}</div>
            <div style={{ fontSize: 17, color: t.eyebrow, marginTop: 18, fontWeight: 600 }}>JazakAllah khair</div>
          </div>
        </div>
      )}
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>{children}</div>
}

/* ============================================================ staff setup */

function StaffSetup({ t, onBound }: { t: Theme; onBound: (token: string, program: string, tenant: string) => void }) {
  const [programs, setPrograms] = useState<ProgramOpt[]>([])
  const [tenantName, setTenantName] = useState('Masjid')
  const [pinSet, setPinSet] = useState(true)
  const [pin, setPin] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [doneProgram, setDoneProgram] = useState<{ token: string; name: string } | null>(null)

  useEffect(() => {
    fetch('/api/checkin/bind')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError('This site has no check-in kiosk configured.'); return }
        setTenantName(d.tenant?.name ?? 'Masjid')
        setPinSet(d.pinSet)
        setPrograms(d.programs ?? [])
        if (d.programs?.length === 1) setSelected(d.programs[0].id)
      })
      .catch(() => setError('Could not reach the server.'))
  }, [])

  const press = (k: string) => () => {
    setError(null)
    if (k === 'Clear') setPin('')
    else if (k === '⌫') setPin((p) => p.slice(0, -1))
    else setPin((p) => (p.length < 6 ? p + k : p))
  }

  const bind = async () => {
    if (busy || pin.length < 4 || !selected) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/checkin/bind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin, programId: selected }),
      })
      const d = await res.json()
      if (res.ok && d.token) setDoneProgram({ token: d.token, name: d.program.name })
      else setError(d.error === 'bad-pin' ? 'Incorrect PIN. Try again.' : 'Could not bind this iPad.')
      setPin('')
    } catch { setError('Could not reach the server.') } finally { setBusy(false) }
  }

  if (doneProgram)
    return (
      <Screen>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'scrFade .32s cubic-bezier(.22,.61,.36,1)' }}>
          <div style={{ textAlign: 'center', maxWidth: 560, padding: '0 40px' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: t.goodSoft, color: t.good, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', animation: 'ringPop .5s cubic-bezier(.22,.61,.36,1)' }}><Check s={48} /></div>
            <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 40, color: t.ink, marginTop: 24 }}>This iPad is ready</div>
            <div style={{ fontSize: 18, color: t.sub, marginTop: 12, lineHeight: 1.55 }}>It&apos;s now the <b style={{ color: t.ink }}>{doneProgram.name}</b> check-in kiosk. Settings are saved on this device — open Guided Access to lock it.</div>
            <div onClick={() => onBound(doneProgram.token, doneProgram.name, tenantName)} style={{ marginTop: 34, display: 'inline-flex', alignItems: 'center', gap: 11, height: 66, padding: '0 40px', borderRadius: 15, background: t.brand, color: t.brandText, fontSize: 20, fontWeight: 600, cursor: 'pointer', boxShadow: t.btnShadow }}>Launch kiosk <Arrow s={21} /></div>
          </div>
        </div>
      </Screen>
    )

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', '⌫']
  const canBind = pin.length >= 4 && !!selected && pinSet
  return (
    <Screen>
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'scrFade .32s cubic-bezier(.22,.61,.36,1)' }}>
        <div style={{ width: 920, maxWidth: '92vw', display: 'flex', gap: 40, alignItems: 'stretch', padding: '0 40px' }}>
          <div style={{ flex: 'none', width: 380, maxWidth: '46%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: t.eyebrow }}>Staff setup · {tenantName}</div>
            <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 36, color: t.ink, marginTop: 10, lineHeight: 1.1 }}>Set up this kiosk</div>
            <div style={{ fontSize: 16, color: t.sub, marginTop: 10, lineHeight: 1.5 }}>{pinSet ? 'Enter your admin PIN to bind this iPad to a program. One-time, per device.' : 'No kiosk PIN is set. Add one in Site settings → Parent Check-in Kiosk first.'}</div>
            <div style={{ display: 'flex', gap: 14, margin: '26px 0 22px' }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: i < pin.length ? t.brand : 'transparent', border: `2px solid ${i < pin.length ? t.brand : t.cardLine}` }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {keys.map((k) => {
                const act = k === 'Clear' || k === '⌫'
                return <div key={k} onClick={press(k)} style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: act ? 18 : 26, fontWeight: 600, borderRadius: 14, cursor: 'pointer', userSelect: 'none', background: act ? 'transparent' : t.keyBg, color: act ? t.faint : t.keyColor, border: `1px solid ${act ? 'transparent' : t.keyLine}` }}>{k}</div>
              })}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: t.faint, marginBottom: 14 }}>Bind to program</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
              {programs.map((p) => {
                const sel = selected === p.id
                return (
                  <div key={p.id} onClick={() => setSelected(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '18px 20px', borderRadius: 14, cursor: 'pointer', background: sel ? t.brandSoft : t.card, border: `2px solid ${sel ? t.brand : t.cardLine}` }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${sel ? t.brand : t.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: sel ? t.brand : 'transparent' }} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: t.ink }}>{p.name}</div>
                      {p.meetingDays?.length > 0 && <div style={{ fontSize: 14, color: t.sub, marginTop: 2, textTransform: 'capitalize' }}>{p.meetingDays.join(', ')}</div>}
                    </div>
                  </div>
                )
              })}
              {!programs.length && <div style={{ fontSize: 15, color: t.faint }}>No active programs found for this masjid.</div>}
            </div>
            {error && <div style={{ marginTop: 14, padding: '12px 18px', borderRadius: 12, background: t.dangerSoft, color: t.danger, fontSize: 15, fontWeight: 500 }}>{error}</div>}
            <div onClick={bind} style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, height: 64, borderRadius: 15, fontSize: 19, fontWeight: 600, cursor: canBind ? 'pointer' : 'default', background: canBind ? t.brand : t.chipBg, color: canBind ? t.brandText : t.faint, opacity: canBind ? 1 : 0.6 }}>{busy ? 'Binding…' : 'Bind this iPad'}</div>
          </div>
        </div>
      </div>
    </Screen>
  )
}
