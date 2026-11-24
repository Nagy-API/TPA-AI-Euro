import { DEMO_MEMBERS } from "./demo-auth/fixtures.ts";
import type { ServiceCode } from "./contracts.ts";

function normalizeArabic(input: string): string {
  return input.normalize("NFKC").replace(/[\u0640\u064b-\u065f\u0670]/gu, "").replace(/[أإآٱ]/gu, "ا");
}

// Scope cues are checked independently of model decisions. They deliberately
// include family/dependents because the demo has no delegated access.
const RELATION = /(?<!\p{L})(?:[وفبكل])?(?:جار[ىي]|جيراني|صاحب(?:ي|تي|نا)|زميل(?:ي|تي|نا)|اخويا|اخي|اختي|ابني|بنتي|عيالي|اولادي|مراتي|زوجتي|جوزي|زوجي|ابويا|والدي|بابا|امي|والدتي|ماما|خالي|خالتي|عمي|عمتي|حما(?:يا|تي)|حفيد(?:ي|تي)|قريب(?:ي|تي)|تابعي)(?!\p{L})/u;
const OTHER_PERSON = /(?<!\p{L})(?:(?:ل)?(?:حد|واحد|واحدة|(?:ال|ل)?(?:عضو|شخص|مريض|حساب))\s+(?:ال)?(?:تاني[ةه]?|تانى|اخر|غيري|معايا)|(?:تامين|تغطيت|عضويت|وثيقت|بوليصت)(?:ه|ها|هم)|(?:تامين|الوثيقة|البوليصة)\s+باسم|بالنيابة\s+عن)(?!\p{L})/u;
const OTHER_OWNER = /(?<!\p{L})(?:التامين|الوثيقة|التغطية|البوليصة|الكارت)\s+(?:بتاع(?:ته|ها|تهم|ه|هم)|بتاع(?:ة|ت)?\s+(?:اللي|حد|شخص|واحد))(?!\p{L})/u;
const OTHER_PERSON_EN = /\b(?:on behalf of|(?:someone|anyone) else|other (?:person|member|account)|(?:his|her|their) (?:insurance|coverage|policy)|my (?:neighbou?r|friend|colleague|coworker|partner|wife|husband|spouse|son|daughter|child|brother|sister|mother|father|parent|dependent))\b/iu;

export function isThirdPartyCoverage(input: string): boolean {
  const normalized = normalizeArabic(input);
  return RELATION.test(normalized) || OTHER_PERSON.test(normalized) ||
    OTHER_OWNER.test(normalized) || OTHER_PERSON_EN.test(normalized);
}

const MRI_EVIDENCE = /\b(?:mri|magnetic resonance(?: imaging)?)\b|(?<!\p{L})[وف]?(?:(?:بال|ال|ب)?رنين|(?:ال)?ام\s+ار\s+ا[يى]|(?:ال)?تصوير\s+(?:بال|ال|ب)?مغنا?طيسي|(?:ب?جهاز|بيصور)\s+(?:بال|ال|ب)?مغناطيس)(?!\p{L})/iu;
const CBC_EVIDENCE = /\b(?:cbc|complete blood count|full blood count)\b|(?<!\p{L})[وف]?(?:ال)?(?:سي\s+بي\s+سي|صور[هة]\s+(?:ال)?دم\s+(?:ال)?كامل[هة]|(?:عد|تعداد)\s+(?:ال)?دم\s+(?:ال)?كامل)(?!\p{L})/iu;
const XRAY_EVIDENCE = /\b(?:x[\s-]?rays?|radiographs?|plain films?)\b|(?<!\p{L})[وف]?(?:(?:بال|ال|ب)?اشع[هة]\s+(?:ال)?(?:سيني[هة]|عادي[هة])|(?:ال)?اكس\s*را[يى])(?!\p{L})/iu;
const COUNTING = /(?<!\p{L})[لب]?(?:عد|بيعد|يعد|بتعد|تعداد|حساب)(?!\p{L})/u;
const BLOOD_CELLS = /(?:كرات|خلايا)\s+(?:ال)?دم/u;
const CELL_TYPES = /(?:حمرا(?:ء)?|حمر).*?(?:بيضا(?:ء)?|بيض)|(?:بيضا(?:ء)?|بيض).*?(?:حمرا(?:ء)?|حمر)/u;
const PLATELETS = /صفايح|صفائح/u;
const EXPLICIT_CORRECTION = /(?:^|[،,.]\s*)(?:لا|لكن|بس)\s+(?:انا\s+)?قصدي\s+|^\s*(?:مش|موش)\s+[^،,.؟]{1,60}[،,.]\s*(?:دي|ده|قصدي)\s+|^\s*(?:(?:طيب|طب)\s+)?بدل\s+[^،,.؟]{1,45}?(?:[،,.]\s*|\s+)(?=عايز|عاوز|محتاج|قصدي)/u;
const REFERENCE_OR_NEGATION = /(?<!\p{L})(?:(?:مش|موش|بدون|من غير)(?!\s+(?:موافق[هة]|تحمل|دفع)(?!\p{L}))|زي|مثل|بدل|بديل|سمي|سميه|اسميه|اسمها|مثال)(?!\p{L})|(?:^|\s)(?:not|instead of|rather than|similar to|such as|rename|pretend|called)\b|[\x60]/iu;
// These cues catch conflicting procedures in mixed requests. Unsupported-only
// requests already fail because they contain no positive catalog evidence.
const COMPETING_PROCEDURE = /(?:كشف|تنظيف|حشو|خلع)\s+(?:(?:جير|عصب)\s+)?(?:اسنان|الاسنان|ضرس|سنان)|علاج\s+طبيعي|(?:اشع[هة]|تصوير)\s+(?:ال)?مقطعي|(?<!\p{L})[وف]?(?:مقطعي[هة]|(?:ال)?سونار|(?:ال)?منظار)(?!\p{L})|(?:سكر\s+تراكمي|وظائف\s+(?:ال)?كبد|تحليل\s+(?:ال)?غد[هة])|\b(?:ct scan|ultrasound|endoscopy|dental (?:exam|checkup)|physiotherapy)\b/iu;

/** Verify a model proposal against positive, unambiguous evidence in user text. */
export function isGroundedCoverageService(input: string, proposed: ServiceCode): boolean {
  const normalized = normalizeArabic(input).replace(/\s+/gu, " ");
  const question = normalized.split(EXPLICIT_CORRECTION).at(-1) ?? "";
  if (REFERENCE_OR_NEGATION.test(question) || COMPETING_PROCEDURE.test(question)) return false;

  const evidence: Record<ServiceCode, boolean> = {
    MRI: MRI_EVIDENCE.test(question),
    CBC: CBC_EVIDENCE.test(question) || (COUNTING.test(question) && BLOOD_CELLS.test(question) &&
      (CELL_TYPES.test(question) || PLATELETS.test(question))),
    XRAY: XRAY_EVIDENCE.test(question)
  };
  return evidence[proposed] && Object.values(evidence).filter(Boolean).length === 1;
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
