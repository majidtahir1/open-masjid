import type { CollectionConfig, FieldHook } from 'payload'

import { platformOwnerOnly } from '../access/tenantScoped'
import { buildMarketingPreviewUrl } from '../lib/previewUrl'

const slugify = (value: string): string =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const autoSlug: FieldHook = ({ value, data, operation }) => {
  if (value) return value
  if (operation === 'create' && data?.title) return slugify(String(data.title))
  return value
}

// Stamp publishedAt the first time a post is published, if the editor left it blank.
const stampPublishedAt: FieldHook = ({ value, data }) => {
  if (value) return value
  if (data?._status === 'published') return new Date().toISOString()
  return value
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Post', plural: 'Posts' },
  admin: {
    group: 'Website',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'publishedAt', 'slug'],
    // Platform-level content — only the platform owner manages it.
    hidden: ({ user }) => (user as { role?: string } | null)?.role !== 'platformOwner',
    description:
      'Marketing articles (The Minbar) and changelog entries for openmasjid.app. Articles render at /minbar, changelog entries at /changelog.',
    preview: (doc) => buildMarketingPreviewUrl(doc, 'minbar'),
    livePreview: {
      url: ({ data }) => buildMarketingPreviewUrl(data, 'minbar') ?? '',
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
    },
  },
  versions: {
    drafts: { schedulePublish: true },
  },
  access: {
    // Public read of published; platform owner sees drafts too.
    read: ({ req: { user } }) => {
      if ((user as { role?: string } | null)?.role === 'platformOwner') return true
      return { _status: { equals: 'published' } }
    },
    create: platformOwnerOnly,
    update: platformOwnerOnly,
    delete: platformOwnerOnly,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Title',
      admin: { placeholder: 'How we run a masjid platform with AI agents' },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'article',
      options: [
        { label: 'Article', value: 'article' },
        { label: 'Changelog Entry', value: 'changelog' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Articles render at /minbar; changelog entries at /changelog.',
      },
    },
    {
      name: 'version',
      type: 'text',
      label: 'Version',
      admin: {
        position: 'sidebar',
        placeholder: 'v1.4.0',
        condition: (data) => data?.kind === 'changelog',
        description: 'Optional version label shown on the changelog.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      label: 'URL Slug',
      admin: {
        position: 'sidebar',
        placeholder: 'running-a-masjid-with-ai-agents',
        description: 'Auto-generated from the title. Lowercase, numbers, dashes.',
      },
      hooks: { beforeValidate: [autoSlug] },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Published date',
      admin: {
        position: 'sidebar',
        description:
          'Shown on the post and used for ordering. Set automatically on first publish if left blank.',
      },
      hooks: { beforeChange: [stampPublishedAt] },
    },
    {
      name: 'author',
      type: 'text',
      defaultValue: 'OpenMasjid Team',
      label: 'Byline',
      admin: { position: 'sidebar' },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero image',
      admin: {
        description:
          'Shown on index cards, at the top of the article, and as the social-share image.',
      },
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      labels: { singular: 'Tag', plural: 'Tags' },
      admin: { description: 'Free-form topic tags. Power filtering on /minbar.' },
      fields: [{ name: 'tag', type: 'text', required: true }],
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Body',
      admin: {
        description: 'The article body. Supports headings, lists, links, and inline images.',
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      admin: {
        position: 'sidebar',
        description:
          'Optional overrides for search/social previews. Falls back to the title, auto-excerpt, and hero image.',
      },
      fields: [
        { name: 'title', type: 'text', label: 'SEO Title' },
        { name: 'description', type: 'textarea', label: 'Meta Description' },
        { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'Share Image' },
      ],
    },
  ],
}

export default Posts
