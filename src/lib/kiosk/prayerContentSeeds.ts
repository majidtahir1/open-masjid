export type ContentKind = 'ayah' | 'hadith' | 'dua' | 'bismillah'

export interface ContentEntry {
  id: string
  kind: ContentKind
  arabic: string
  english: string
  citation: string
}

export const PRAYER_CONTENT_SEEDS: ContentEntry[] = [
  {
    id: 'seed-bismillah',
    kind: 'bismillah',
    arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
    english: 'In the name of Allah, the Most Gracious, the Most Merciful',
    citation: '',
  },
  {
    id: 'seed-ayah-1',
    kind: 'ayah',
    arabic: 'وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ وَارْكَعُوا مَعَ الرَّاكِعِينَ',
    english: 'And establish prayer and give zakah and bow with those who bow.',
    citation: 'Al-Baqarah 2:43',
  },
  {
    id: 'seed-ayah-2',
    kind: 'ayah',
    arabic: 'وَالَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ لَهُمْ جَنَّاتٌ تَجْرِي مِن تَحْتِهَا الْأَنْهَارُ',
    english: 'And those who believe and do righteous deeds will have gardens beneath which rivers flow.',
    citation: 'Al-Baqarah 2:25',
  },
  {
    id: 'seed-ayah-3',
    kind: 'ayah',
    arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    english: 'Indeed, with hardship comes ease.',
    citation: 'Ash-Sharh 94:6',
  },
  {
    id: 'seed-ayah-4',
    kind: 'ayah',
    arabic: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا',
    english: 'And whoever fears Allah - He will make for him a way out.',
    citation: 'At-Talaq 65:2',
  },
  {
    id: 'seed-ayah-5',
    kind: 'ayah',
    arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
    english: 'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
    citation: 'Al-Baqarah 2:152',
  },
  {
    id: 'seed-ayah-6',
    kind: 'ayah',
    arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    english: 'Verily, in the remembrance of Allah do hearts find rest.',
    citation: "Ar-Ra'd 13:28",
  },
  {
    id: 'seed-ayah-7',
    kind: 'ayah',
    arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    english: 'Allah does not burden a soul beyond that it can bear.',
    citation: 'Al-Baqarah 2:286',
  },
  {
    id: 'seed-ayah-8',
    kind: 'ayah',
    arabic: 'وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا',
    english: 'And those who strive for Us - We will surely guide them to Our ways.',
    citation: 'Al-Ankabut 29:69',
  },
  {
    id: 'seed-hadith-1',
    kind: 'hadith',
    arabic: 'الصَّلَوَاتُ الْخَمْسُ وَالْجُمُعَةُ إِلَى الْجُمُعَةِ كَفَّارَةٌ لِمَا بَيْنَهُنَّ',
    english: 'The five prayers and Friday prayer to Friday prayer are expiation for what is between them.',
    citation: 'Sahih Muslim',
  },
  {
    id: 'seed-hadith-2',
    kind: 'hadith',
    arabic: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ',
    english: 'The best of people are those who are most beneficial to others.',
    citation: "Al-Mu'jam al-Awsat",
  },
  {
    id: 'seed-hadith-3',
    kind: 'hadith',
    arabic: 'مَنْ كَانَ فِي حَاجَةِ أَخِيهِ كَانَ اللَّهُ فِي حَاجَتِهِ',
    english: 'Whoever fulfills the needs of his brother, Allah will fulfill his needs.',
    citation: 'Sahih Bukhari',
  },
  {
    id: 'seed-hadith-4',
    kind: 'hadith',
    arabic: 'الدِّينُ النَّصِيحَةُ',
    english: 'Religion is sincere advice.',
    citation: 'Sahih Muslim',
  },
  {
    id: 'seed-hadith-5',
    kind: 'hadith',
    arabic: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ',
    english: 'Your smile in the face of your brother is charity.',
    citation: "Jami' at-Tirmidhi",
  },
  {
    id: 'seed-hadith-6',
    kind: 'hadith',
    arabic: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ',
    english:
      'The strong believer is better and more beloved to Allah than the weak believer, and in each there is good.',
    citation: 'Sahih Muslim',
  },
  {
    id: 'seed-hadith-7',
    kind: 'hadith',
    arabic: 'يَسِّرُوا وَلَا تُعَسِّرُوا وَبَشِّرُوا وَلَا تُنَفِّرُوا',
    english: 'Make things easy and do not make them difficult. Give glad tidings and do not drive people away.',
    citation: 'Sahih Bukhari',
  },
  {
    id: 'seed-hadith-8',
    kind: 'hadith',
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    english: 'None of you truly believes until he loves for his brother what he loves for himself.',
    citation: 'Sahih Bukhari',
  },
  {
    id: 'seed-hadith-9',
    kind: 'hadith',
    arabic: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    english: 'The most beloved deeds to Allah are those done consistently, even if they are small.',
    citation: 'Sahih Bukhari',
  },
]

export interface PrayerContentSeedRow {
  tenant: number
  kind: ContentKind
  arabic: string
  english: string
  citation: string
  active: true
}

/**
 * Map the in-code seeds to create-payloads for the `prayer-display-content`
 * collection, scoped to a tenant. The in-code `id` is intentionally dropped —
 * the DB assigns its own. Used by both the tenant-create seeding hook and the
 * one-shot backfill script so existing and future tenants get the same set.
 */
export function prayerContentSeedRows(tenantId: number): PrayerContentSeedRow[] {
  return PRAYER_CONTENT_SEEDS.map((s) => ({
    tenant: tenantId,
    kind: s.kind,
    arabic: s.arabic,
    english: s.english,
    citation: s.citation,
    active: true,
  }))
}
