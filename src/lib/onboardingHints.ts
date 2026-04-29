import type { MilestoneSlug } from './onboarding'

export type Hint = {
  headline: string
  body: string
  /** Admin path the link opens. Always opens in a new tab. */
  href?: string
}

export const HINTS: Record<MilestoneSlug, Hint[]> = {
  branding: [
    {
      headline: 'Live preview is one click away.',
      body: 'Open your public site in a new tab — color edits reflect in real time.',
    },
    {
      headline: 'SVG logos resize cleanly.',
      body: "Upload an SVG and we'll size it for every screen automatically.",
    },
    {
      headline: 'Three colors do all the work.',
      body: 'Pick brand, secondary, and accent — we derive the full palette.',
    },
    {
      headline: 'Custom font?',
      body: 'Paste any Google Fonts URL in the advanced section.',
    },
  ],
  identity: [
    {
      headline: 'Address auto-fills your map and timezone.',
      body: 'Type a real address and we geocode it for prayer times and the contact map.',
    },
    {
      headline: 'Empty socials are hidden.',
      body: 'Add only the platforms your jamaa actually uses — blanks never render.',
    },
    {
      headline: 'Footer tagline shows on every page.',
      body: "It's the line above the legal text. Keep it short and warm.",
    },
  ],
  prayer: [
    {
      headline: 'Three ways to keep them current.',
      body: 'Aladhan auto-update, CSV bulk import, or manual entry. Mix them however you like.',
    },
    {
      headline: 'Iqamah overrides per day.',
      body: 'Tweak any single day without rewriting the rest of the schedule.',
    },
    {
      headline: 'Multiple jummah slots are first-class.',
      body: "Add as many khutbas as you need — the public site shows them all.",
    },
  ],
  firstEvent: [
    {
      headline: 'Recurring events: write them naturally.',
      body: '"Mondays after Isha" is a real, supported value. So is "First Saturday."',
    },
    {
      headline: 'Three flyer modes.',
      body: 'Upload your own, auto-generate one in your colors, or skip the flyer entirely.',
    },
    {
      headline: 'Audience tags.',
      body: 'Tag for sisters, brothers, youth, families. Visitors filter themselves.',
    },
    {
      headline: 'Schedule events to publish later.',
      body: 'Save as draft, set a publish date, walk away.',
    },
  ],
  hero: [
    {
      headline: 'Featured events become hero slides.',
      body: 'Mark an event as featured and it auto-appears in the homepage rotation.',
    },
    {
      headline: 'PhotoTone keeps text readable.',
      body: 'We sample your image to pick a tone, so headlines stay legible no matter the photo.',
    },
    {
      headline: 'Drag to reorder.',
      body: 'Slides reorder live in the admin — no save needed between drags.',
    },
  ],
  donations: [
    {
      headline: "Stripe charges Stripe's fee. We don't take a cut.",
      body: '2.9% + 30¢ in the US. The rest goes to your masjid.',
    },
    {
      headline: 'Sadaqah, Zakat, Building Fund.',
      body: 'Donors pick a category at checkout — you get a real report by category.',
    },
    {
      headline: 'Already on LaunchGood?',
      body: 'Just paste the URL. The donate button links straight there.',
    },
  ],
}
