// Maps keys typed on a US/English keyboard layout to the character that would
// have been produced had the OS been switched to the standard Arabic (101)
// layout. Lets users search Arabic names without switching layouts, e.g.
// typing "Hpl]" (English keys) resolves to "أحمد".
const EN_TO_AR: Record<string, string> = {
  '`': 'ذ', '~': 'ّ',
  q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع', i: 'ه', o: 'خ', p: 'ح',
  '[': 'ج', ']': 'د', '\\': '\\',
  Q: 'َ', W: 'ً', E: 'ُ', R: 'ٌ', T: 'لإ', Y: 'إ', U: '’', I: '÷', O: '×', P: '؛',
  '{': '<', '}': '>', '|': '|',
  a: 'ش', s: 'س', d: 'ي', f: 'ب', g: 'ل', h: 'ا', j: 'ت', k: 'ن', l: 'م', ';': 'ك', "'": 'ط',
  A: 'ِ', S: 'ٍ', D: ']', F: '[', G: 'لأ', H: 'أ', J: 'ـ', K: '،', L: '/', ':': ':', '"': '"',
  z: 'ئ', x: 'ء', c: 'ؤ', v: 'ر', b: 'لا', n: 'ة', m: 'و', ',': ',', '.': '.', '/': '/',
  Z: '~', X: 'ْ', C: '}', V: '{', B: 'لآ', N: '’', M: ',', '<': ',', '>': '.', '?': '؟',
}

const AR_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_AR)
    .filter(([key]) => /^[a-zA-Z]$/.test(key))
    .map(([key, value]) => [value, key]),
)

function remap(input: string, table: Record<string, string>): string {
  return Array.from(input)
    .map((char) => table[char] ?? char)
    .join('')
}

/** Converts text typed on an English keyboard layout into the Arabic it would have produced. */
export function englishKeysToArabic(input: string): string {
  return remap(input, EN_TO_AR)
}

/** Converts Arabic text back into the English keys that would have produced it. */
export function arabicToEnglishKeys(input: string): string {
  return remap(input, AR_TO_EN)
}
