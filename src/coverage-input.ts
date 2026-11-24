import { DEMO_MEMBERS } from "./demo-auth/fixtures.ts";

function normalizeArabic(input: string): string {
  return input.normalize("NFKC").replace(/[\u0640\u064b-\u065f\u0670]/gu, "").replace(/[أإآٱ]/gu, "ا");
}

// Scope cues are checked independently of model decisions. They deliberately
// include family/dependents because the demo has no delegated access.
const RELATION = /(?<!\p{L})(?:[وفبكل])?(?:جار[ىي]|جيراني|صاحب(?:ي|تي|نا)|زميل(?:ي|تي|نا)|اخويا|اخي|اختي|ابني|بنتي|عيالي|اولادي|مراتي|زوجتي|جوزي|زوجي|ابويا|والدي|بابا|امي|والدتي|ماما|خالي|خالتي|عمي|عمتي|حمايا|حفيد(?:ي|تي)|قريب(?:ي|تي)|تابعي)(?!\p{L})/u;
const OTHER_PERSON = /(?<!\p{L})(?:(?:ل)?(?:حد|واحد|واحدة|(?:ال|ل)?(?:عضو|شخص|مريض|حساب))\s+(?:ال)?(?:تاني[ةه]?|تانى|اخر|غيري|معايا)|(?:تامين|تغطيت|عضويت|وثيقت|بوليصت)(?:ه|ها|هم)|(?:تامين|الوثيقة|البوليصة)\s+باسم|بالنيابة\s+عن)(?!\p{L})/u;
const OTHER_OWNER = /(?<!\p{L})(?:التامين|الوثيقة|التغطية|البوليصة|الكارت)\s+(?:بتاع(?:ته|ها|تهم|ه|هم)|بتاع(?:ة|ت)?\s+(?:اللي|حد|شخص|واحد))(?!\p{L})/u;
const OTHER_PERSON_EN = /\b(?:on behalf of|(?:someone|anyone) else|other (?:person|member|account)|(?:his|her|their) (?:insurance|coverage|policy)|my (?:neighbou?r|friend|colleague|coworker|partner|wife|husband|spouse|son|daughter|child|brother|sister|mother|father|parent|dependent))\b/iu;

export function isThirdPartyCoverage(input: string): boolean {
  const normalized = normalizeArabic(input);
  return RELATION.test(normalized) || OTHER_PERSON.test(normalized) ||
    OTHER_OWNER.test(normalized) || OTHER_PERSON_EN.test(normalized);
}

export function hasUnspecifiedArabicImaging(input: string): boolean {
  const normalized = normalizeArabic(input);
  return /(?<!\p{L})(?:بال|ال|ب)?اشع[هة](?!\p{L})/u.test(normalized) &&
    !/(?<!\p{L})(?:ال)?(?:سيني[هة]?|عادي[هة]|اكس\s*را[يى])(?!\p{L})|\bx[\s-]?ray\b/iu.test(normalized);
}

const PRIVATE_LABEL = /\b(?:otp|passcode|password|token|bearer|api[ _-]?key|national[ _-]?id|ssn|vip|gold|silver)\b|\b(?:member|tenant|policy|insurance|card|account|phone)\s*(?:id|key|number|no\.?)\b|(?:رقم|رقمي|كود|رمز)\s+(?:العضوية|العضو|الوثيقة|البوليصة|التامين|الكارت|البطاقة|التحقق|الهوية|القومي|الشركة|الحساب|الموبايل|الهاتف)|(?:كلمة\s+السر|التوكن)/iu;
const PRIVATE_FORMAT = /@|\p{Cf}|[A-Za-z0-9_-]{32,}|\b(?:[a-z]+[-_])?demo[-_][a-z0-9]+|\b(?:id|member|tenant|policy|pol)[-_][a-z0-9_-]*\d|\b(?=[a-z0-9]{6,}\b)(?=[a-z0-9]*[a-z])(?=[a-z0-9]*\d)[a-z0-9]+\b/iu;
const DEMO_CODES = new Set<string>(DEMO_MEMBERS.map(({ code }) => code));
const AMOUNT_UNIT = /^\s*(?:[%٪]|(?:جنيه(?:ات)?|جم|egp|usd)(?!\p{L}))/iu;

export function hasPrivateCoverageInput(input: string): boolean {
  const normalized = normalizeArabic(input).replace(/[٠-٩۰-۹]/gu, (digit) => String(digit.charCodeAt(0) & 15));
  if (PRIVATE_FORMAT.test(normalized) || PRIVATE_LABEL.test(normalized)) return true;

  for (const match of normalized.matchAll(/\d+(?:[-.,/\u066b\u066c \t]+\d+)*/gu)) {
    const digits = match[0].replace(/\D/g, "");
    if (DEMO_CODES.has(digits) || digits.length >= 9) return true;
    if (digits.length >= 6) {
      const isAmount = /^\d+(?:[,.\u066b\u066c]\d+)*$/u.test(match[0]) &&
        AMOUNT_UNIT.test(normalized.slice(match.index + match[0].length));
      if (!isAmount) return true;
    }
  }
  return false;
}
