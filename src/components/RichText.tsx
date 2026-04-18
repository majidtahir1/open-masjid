import type { ReactNode } from 'react'

/**
 * Minimal Lexical richText renderer. Walks a Payload Lexical JSON blob
 * (`{ root: { children: [...] } }`) and renders a limited set of node types:
 * paragraph, heading, list, listitem, quote, link, text.
 *
 * Intentionally simple — not a full Lexical renderer. Good enough to display
 * tenant-authored page and event copy. Unknown nodes are ignored gracefully.
 */

interface LexicalNode {
  type?: string
  tag?: string
  text?: string
  format?: number | string
  url?: string
  fields?: { url?: string; newTab?: boolean }
  children?: LexicalNode[]
  listType?: 'number' | 'bullet' | 'check'
  value?: { url?: string }
}

interface LexicalRoot {
  root?: {
    children?: LexicalNode[]
  }
}

function renderText(node: LexicalNode, key: string): ReactNode {
  const text = node.text ?? ''
  if (!text) return null
  // Lexical text format bitfield: 1=bold, 2=italic, 4=strikethrough, 8=underline, 16=code
  const fmt = typeof node.format === 'number' ? node.format : 0
  let el: ReactNode = text
  if (fmt & 1) el = <strong key={key}>{el}</strong>
  if (fmt & 2) el = <em key={key}>{el}</em>
  if (fmt & 8) el = <u key={key}>{el}</u>
  if (fmt & 16) el = <code key={key}>{el}</code>
  return <span key={key}>{el}</span>
}

function renderChildren(children: LexicalNode[] | undefined): ReactNode[] {
  if (!children) return []
  return children.map((child, i) => renderNode(child, String(i)))
}

function renderNode(node: LexicalNode, key: string): ReactNode {
  if (!node || !node.type) return null

  switch (node.type) {
    case 'text':
      return renderText(node, key)

    case 'linebreak':
      return <br key={key} />

    case 'paragraph':
      return (
        <p key={key} className="mb-4 text-fs-base leading-relaxed text-fg2">
          {renderChildren(node.children)}
        </p>
      )

    case 'heading': {
      const tag = (node.tag as string) || 'h2'
      const cls =
        tag === 'h1'
          ? 'mt-8 mb-4 font-display text-[40px] font-medium leading-tight text-fg1'
          : tag === 'h2'
            ? 'mt-8 mb-3 font-display text-[32px] font-medium leading-tight text-fg1'
            : tag === 'h3'
              ? 'mt-6 mb-2 font-display text-[24px] font-semibold leading-snug text-fg1'
              : 'mt-4 mb-2 font-display text-[20px] font-semibold text-fg1'
      const Tag = tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return (
        <Tag key={key} className={cls}>
          {renderChildren(node.children)}
        </Tag>
      )
    }

    case 'quote':
      return (
        <blockquote
          key={key}
          className="my-6 border-l-4 border-brand bg-brand-soft/40 px-5 py-3 text-fs-base italic leading-relaxed text-fg1"
        >
          {renderChildren(node.children)}
        </blockquote>
      )

    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul'
      const cls =
        Tag === 'ol'
          ? 'mb-4 ml-6 list-decimal space-y-1 text-fs-base text-fg2'
          : 'mb-4 ml-6 list-disc space-y-1 text-fs-base text-fg2'
      return (
        <Tag key={key} className={cls}>
          {renderChildren(node.children)}
        </Tag>
      )
    }

    case 'listitem':
      return <li key={key}>{renderChildren(node.children)}</li>

    case 'link':
    case 'autolink': {
      const href = node.fields?.url ?? node.url ?? node.value?.url ?? '#'
      const newTab = node.fields?.newTab
      return (
        <a
          key={key}
          href={href}
          target={newTab ? '_blank' : undefined}
          rel={newTab ? 'noopener noreferrer' : undefined}
          className="text-brand underline underline-offset-2 hover:text-brand-hover"
        >
          {renderChildren(node.children)}
        </a>
      )
    }

    default:
      // Unknown block — try to render children so we don't drop content.
      if (node.children) return <span key={key}>{renderChildren(node.children)}</span>
      return null
  }
}

export interface RichTextProps {
  data: unknown
  /** Optional class on the outer wrapper. */
  className?: string
}

export default function RichText({ data, className }: RichTextProps) {
  const root = (data as LexicalRoot | null | undefined)?.root
  if (!root || !root.children || root.children.length === 0) return null
  return <div className={className}>{renderChildren(root.children)}</div>
}
