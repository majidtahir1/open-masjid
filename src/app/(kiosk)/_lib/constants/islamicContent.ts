/**
 * Islamic content data for kiosk display
 * Ported from kiosk repo: apps/kiosk/src/data/islamicContent.ts
 */

export interface IslamicContent {
  id: string
  type: 'ayah' | 'hadith'
  arabic: string
  english: string
  reference?: string
  source?: string
  theme?: string
}

export const ISLAMIC_CONTENT: { ayahs: IslamicContent[]; hadiths: IslamicContent[] } = {
  ayahs: [
    {
      id: 'ayah-1',
      type: 'ayah',
      arabic: 'وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ وَارْكَعُوا مَعَ الرَّاكِعِينَ',
      english: 'And establish prayer and give zakah and bow with those who bow.',
      reference: 'Al-Baqarah 2:43',
      theme: 'Prayer and Charity',
    },
    {
      id: 'ayah-2',
      type: 'ayah',
      arabic: 'وَالَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ لَهُمْ جَنَّاتٌ تَجْرِي مِن تَحْتِهَا الْأَنْهَارُ',
      english: 'And those who believe and do righteous deeds will have gardens beneath which rivers flow.',
      reference: 'Al-Baqarah 2:25',
      theme: 'Faith and Good Deeds',
    },
    {
      id: 'ayah-3',
      type: 'ayah',
      arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
      english: 'Indeed, with hardship comes ease.',
      reference: 'Ash-Sharh 94:6',
      theme: 'Hope and Patience',
    },
    {
      id: 'ayah-4',
      type: 'ayah',
      arabic: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا',
      english: 'And whoever fears Allah - He will make for him a way out.',
      reference: 'At-Talaq 65:2',
      theme: 'Trust in Allah',
    },
    {
      id: 'ayah-5',
      type: 'ayah',
      arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
      english: 'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
      reference: 'Al-Baqarah 2:152',
      theme: 'Remembrance of Allah',
    },
    {
      id: 'ayah-6',
      type: 'ayah',
      arabic: 'وَإِن تَشْكُرُوا يَرْضَهُ لَكُمْ',
      english: 'And if you are grateful, He is pleased with it for you.',
      reference: 'Az-Zumar 39:7',
      theme: 'Gratitude',
    },
    {
      id: 'ayah-7',
      type: 'ayah',
      arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
      english: 'Verily, in the remembrance of Allah do hearts find rest.',
      reference: "Ar-Ra'd 13:28",
      theme: 'Inner Peace',
    },
    {
      id: 'ayah-8',
      type: 'ayah',
      arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
      english: 'Allah does not burden a soul beyond that it can bear.',
      reference: 'Al-Baqarah 2:286',
      theme: 'Patience',
    },
    {
      id: 'ayah-9',
      type: 'ayah',
      arabic: 'وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا',
      english: 'And those who strive for Us - We will surely guide them to Our ways.',
      reference: 'Al-Ankabut 29:69',
      theme: 'Effort and Guidance',
    },
  ],
  hadiths: [
    {
      id: 'hadith-1',
      type: 'hadith',
      arabic: 'الصَّلَوَاتُ الْخَمْسُ وَالْجُمُعَةُ إِلَى الْجُمُعَةِ كَفَّارَةٌ لِمَا بَيْنَهُنَّ',
      english: 'The five prayers and Friday prayer to Friday prayer are expiation for what is between them.',
      source: 'Sahih Muslim',
      theme: 'Prayer',
    },
    {
      id: 'hadith-2',
      type: 'hadith',
      arabic: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ',
      english: 'The best of people are those who are most beneficial to others.',
      source: "Al-Mu'jam al-Awsat",
      theme: 'Service to Others',
    },
    {
      id: 'hadith-3',
      type: 'hadith',
      arabic: 'مَنْ كَانَ فِي حَاجَةِ أَخِيهِ كَانَ اللَّهُ فِي حَاجَتِهِ',
      english: 'Whoever fulfills the needs of his brother, Allah will fulfill his needs.',
      source: 'Sahih Bukhari',
      theme: 'Helping Others',
    },
    {
      id: 'hadith-4',
      type: 'hadith',
      arabic: 'الدِّينُ النَّصِيحَةُ',
      english: 'Religion is sincere advice.',
      source: 'Sahih Muslim',
      theme: 'Sincerity',
    },
    {
      id: 'hadith-5',
      type: 'hadith',
      arabic: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ',
      english: 'Your smile in the face of your brother is charity.',
      source: "Jami' at-Tirmidhi",
      theme: 'Kindness',
    },
    {
      id: 'hadith-6',
      type: 'hadith',
      arabic: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ',
      english:
        'The strong believer is better and more beloved to Allah than the weak believer, and in each there is good.',
      source: 'Sahih Muslim',
      theme: 'Strength',
    },
    {
      id: 'hadith-7',
      type: 'hadith',
      arabic: 'يَسِّرُوا وَلَا تُعَسِّرُوا وَبَشِّرُوا وَلَا تُنَفِّرُوا',
      english: 'Make things easy and do not make them difficult. Give glad tidings and do not drive people away.',
      source: 'Sahih Bukhari',
      theme: 'Ease and Encouragement',
    },
    {
      id: 'hadith-8',
      type: 'hadith',
      arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
      english: 'None of you truly believes until he loves for his brother what he loves for himself.',
      source: 'Sahih Bukhari',
      theme: 'Brotherhood',
    },
    {
      id: 'hadith-9',
      type: 'hadith',
      arabic: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
      english: 'The most beloved deeds to Allah are those done consistently, even if they are small.',
      source: 'Sahih Bukhari',
      theme: 'Consistency',
    },
  ],
}

export const getRandomIslamicContent = (): IslamicContent => {
  const allContent = [...ISLAMIC_CONTENT.ayahs, ...ISLAMIC_CONTENT.hadiths]
  const randomIndex = Math.floor(Math.random() * allContent.length)
  return allContent[randomIndex]
}

export const getIslamicContentByType = (type: 'ayah' | 'hadith'): IslamicContent => {
  const content = type === 'ayah' ? ISLAMIC_CONTENT.ayahs : ISLAMIC_CONTENT.hadiths
  const randomIndex = Math.floor(Math.random() * content.length)
  return content[randomIndex]
}
