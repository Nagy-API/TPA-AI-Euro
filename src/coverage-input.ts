import { DEMO_MEMBERS } from "./demo-auth/fixtures.ts";
import { SERVICE_CODES, type ServiceCode } from "./contracts.ts";
import type { Focus } from "./conversation-intent.ts";

export function normalizeArabic(input: string): string {
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

const MRI_EVIDENCE = /\b(?:mri|magnetic resonance(?: imaging)?)\b|(?<!\p{L})[وف]?(?:(?:بال|لل|ال|ب|ل)?رنين|(?:ال)?ام\s+ار\s+ا[يى]|(?:ال)?تصوير\s+(?:بال|ال|ب)?مغنا?طيسي|(?:ب?جهاز|بيصور)\s+(?:بال|ال|ب)?مغناطيس)(?!\p{L})/iu;
const CBC_EVIDENCE = /\b(?:cbc|complete blood count|full blood count)\b|(?<!\p{L})[وف]?ب?(?:ال)?(?:سي\s+بي\s+سي|صور[هة]\s+(?:ال)?دم\s+(?:ال)?كامل[هة]|(?:عد|تعداد)\s+(?:ال)?دم\s+(?:ال)?كامل)(?!\p{L})/iu;
const XRAY_EVIDENCE = /\b(?:x[\s-]?rays?|radiographs?|plain films?)\b|(?<!\p{L})[وف]?(?:(?:بال|ال|ب)?اشع[هة]\s+(?:ال)?(?:سيني[هة]|عادي[هة]|اكس)|(?:ال)?اكس\s*را[يى])(?!\p{L})/iu;
const CATALOG_NAMES = { MRI: MRI_EVIDENCE, CBC: CBC_EVIDENCE, XRAY: XRAY_EVIDENCE };
const COUNTING = /(?<!\p{L})[لب]?(?:عد|بيعد|يعد|بتعد|تعداد|حساب)(?!\p{L})/u;
const BLOOD_CELLS = /(?:كرات|خلايا)\s+(?:ال)?دم/u;
const CELL_TYPES = /(?:حمرا(?:ء)?|حمر).*?(?:بيضا(?:ء)?|بيض)|(?:بيضا(?:ء)?|بيض).*?(?:حمرا(?:ء)?|حمر)/u;
const PLATELETS = /صفايح|صفائح/u;
const EXPLICIT_CORRECTION = /(?:^|[،,.]\s*)(?:لا|لكن|بس)\s+(?:انا\s+)?قصدي\s+|^\s*(?:مش|موش)\s+[^،,.؟]{1,60}[،,.]\s*(?:دي|ده|قصدي)\s+|^\s*(?:(?:طيب|طب)\s+)?بدل\s+[^،,.؟]{1,45}?(?:[،,.]\s*|\s+)(?=عايز|عاوز|محتاج|قصدي)/u;
const REFERENCE_OR_NEGATION = /(?<!\p{L})(?:(?:مش|موش|بدون|من غير)(?!\s+(?:موافق[هة]|تحمل|دفع|اذن|تصريح)(?!\p{L}))|زي|مثل|بدل|بديل|سمي|سميه|اسميه|اسمها|مثال)(?!\p{L})|(?:^|\s)(?:not|instead of|rather than|similar to|such as|rename|pretend|called)\b|[\x60]/iu;
// These cues catch conflicting procedures in mixed requests. Unsupported-only
// requests already fail because they contain no positive catalog evidence.
const COMPETING_PROCEDURE = /(?:كشف|تنظيف|حشو|خلع)\s+(?:(?:جير|عصب)\s+)?(?:اسنان|الاسنان|ضرس|سنان)|علاج\s+طبيعي|(?:اشع[هة]|تصوير)\s+(?:ال)?مقطعي|(?:تصوير|فحص)\s+(?:بـ?)?(?:ال)?موجات\s+(?:فوق\s+)?صوتي[هة]|(?<!\p{L})[وف]?(?:مقطعي[هة]|(?:ال)?سونار|(?:ال)?منظار)(?!\p{L})|(?:سكر\s+تراكمي|وظائف\s+(?:ال)?كبد|تحليل\s+(?:ال)?غد[هة])|\b(?:ct scan|ultrasound|endoscopy|dental (?:exam|checkup)|physiotherapy)\b/iu;
const DENTAL = /تبييض\s+(?:ال)?(?:اسنان|سنان)|تنظيف\s+جير|تقويم[^؟،.!]{0,20}(?:اسنان|سنان)|\b(?:tooth|teeth|dental)\s+(?:bleaching|whitening)\b/iu;
const DOPPLER = /(?<!\p{L})(?:ال)?دوبلر(?!\p{L})|\bdoppler\b/iu;
const APPROVAL_ACTION = /(?<!\p{L})(?:سجل|اصدر|اعتمد|وافق\s+على|الغ[ىي]|عدل|غير|حدث)\s+(?:(?:طلب|الطلب|شرط|حالة)\s+)?(?:ال)?(?:موافق[هة]|وثيق[هة]|بوليص[هة])(?!\p{L})|\b(?:issue|grant|submit|revoke|change|modify)\s+(?:an? |the |my )?(?:approval|policy)\b/iu;
const CHAT_OVERRIDE = /\b(?:ignore|override|system prompt|tool_calls|get_member_coverage|serviceCode|impersonate|pretend)\b|(?:تجاهل|اتجاهل|اكسر|الغي)\s+(?:كل\s+)?(?:ال)?(?:تعليمات|قواعد|قيود)|(?:نفذ|شغل|استدعي)\s+(?:ال)?(?:اداة|تول)|(?:اعتبر|افترض)\s+(?:انك|نفسك|اني)|(?:اديني|اعمللي|طلعلي|اصدر)\s+موافق[هة]/iu;

export function blocksConversationLookup(input: string): boolean {
  const text = normalizeArabic(input);
  return CHAT_OVERRIDE.test(text) || APPROVAL_ACTION.test(text);
}

export function coverageSubjectText(input: string): string {
  const normalized = normalizeArabic(input).replace(/\s+/gu, " ");
  return normalized.split(EXPLICIT_CORRECTION).at(-1) ?? "";
}

export function inspectServiceSubject(input: string) {
  const question = coverageSubjectText(input);
  const evidence: Record<ServiceCode, boolean> = {
    MRI: MRI_EVIDENCE.test(question),
    CBC: CBC_EVIDENCE.test(question) || (COUNTING.test(question) && BLOOD_CELLS.test(question) &&
      (CELL_TYPES.test(question) || PLATELETS.test(question))),
    XRAY: XRAY_EVIDENCE.test(question)
  };
  return {
    named: SERVICE_CODES.filter((code) => evidence[code]),
    unsupported: COMPETING_PROCEDURE.test(question) || DENTAL.test(question) || DOPPLER.test(question),
    comparison: REFERENCE_OR_NEGATION.test(question)
  };
}

export function hasGroundedServiceQuote(input: string, quote: string, code: ServiceCode): boolean {
  if (inspectServiceSubject(quote).named.includes(code)) return true;
  const utterance = normalizeArabic(input);
  const evidence = normalizeArabic(quote);
  switch (code) {
    case "MRI":
      return /مغنا?طيس|magnet/iu.test(evidence) && /صور|تصوير|اشع[هة]|imaging|scan/iu.test(utterance);
    case "CBC":
      return /صفايح|صفائح|platelets|حمرا|حمر|red (?:blood )?cells/iu.test(evidence) &&
        /دم|كريات|كرات|خلايا|blood/iu.test(utterance) && /بيضا|بيض|white (?:blood )?cells/iu.test(utterance) &&
        /صفايح|صفائح|platelets/iu.test(utterance);
    case "XRAY":
      return false;
  }
}

export function explicitBenefitFocus(input: string): Focus | undefined {
  const question = normalizeArabic(input);
  const signals = {
    COPAY: /فاتور|من جيبي|(?:هدفع|ادفع|بدفع)|تحم[ّ]?ل|كوبا[ىي]|في المي[هة]|نسب[هة].{0,20}(?:الوثيق[هة]|كام|علي)|كام\s+نسب[هة]|\bcopay\b/iu.test(question),
    LIMIT: /متبقي|(?:حد|رصيد|سقف|متاح).{0,22}(?:كام|لسه|قد ايه)|(?:فاضل|باقي|هيفضل).*?(?:حد|رصيد|سقف)|\bremaining (?:limit|balance)\b/iu.test(question),
    PREAPPROVAL: /موافق[هة]|اعتماد|(?:ال)?اذن|استاذن|تصريح|\bpre[ -]?approval\b/iu.test(question)
  } satisfies Record<Exclude<Focus, "OVERVIEW">, boolean>;
  const matched = (Object.keys(signals) as (keyof typeof signals)[]).filter((focus) => signals[focus]);
  return matched.length === 1 ? matched[0] : undefined;
}

export function asksDefinition(input: string): boolean {
  return /(?:يعني\s+(?:ايه|ايش)|معنى|معنا(?:ه|ها)\s+(?:ايه|ايش)|المقصود\s+(?:ب|من)|الفرق بين|\b(?:what does .* mean|definition|define)\b)/iu.test(normalizeArabic(input));
}

/** A standalone benefit label can refer only to the active topic. */
export function standaloneBenefitFocus(input: string): Focus | undefined {
  const label = normalizeArabic(input).trim().replace(/[؟?!.]+$/gu, "").trim()
    .replace(/^و\s*|^(?:طب|طيب)\s+/u, "");
  if (/^(?:نسبة\s+)?(?:ال)?تحمل$|^co[ -]?pay$/iu.test(label)) return "COPAY";
  if (/^(?:ال)?حد\s+(?:ال)?متبقي$|^remaining limit$/iu.test(label)) return "LIMIT";
  if (/^(?:ال)?موافق[هة]\s+(?:ال)?مسبق[هة]$|^pre[ -]?approval$/iu.test(label)) return "PREAPPROVAL";
  return undefined;
}

export function asksPolicyBenefit(input: string): boolean {
  const question = normalizeArabic(input);
  return /تغطي|م(?:ت)?غط[ىي]|(?:داخل|موجود)\s+(?:عندي|ليا)|داخل[هة]?\s*[؟?]|[بت]يتحسب\s+على|بتتحسب\s+ازاي|\b(?:cover|covered)\b/iu.test(question) ||
    /(?:تامين|وثيق[هة]).{0,24}(?:[بت]ي?شارك|بيسدد|بتسدد|بيشيل|بتشيل)/u.test(question) ||
    (!asksDefinition(question) && explicitBenefitFocus(question) !== undefined &&
      /كام|قد ايه|عندي|عليا|علي[ّ]?ا|ليا|بتاعي|بتاعتي|محتاج|محتاجة|لازم|اذن|موافقة\s*[؟?]|تحمل\s*[؟?]|\b(?:my|how much|do i need)\b/iu.test(question));
}

export function asksWhetherReferencedAmountIsDue(input: string): boolean {
  const question = normalizeArabic(input);
  return /(?:\b(?:this|that) (?:amount|balance)\b|(?:ده|دي|دا)\s+(?:ال)?مبلغ|(?:ال)?رصيد\s+(?:ده|دا))/iu.test(question) &&
    /(?:مطالب|مطلوب|لازم).{0,20}(?:ادفع|دفع)|فاتور.{0,16}مطلوب|\b(?:owe|must pay|have to pay)\b/iu.test(question) &&
    !/كام|قد ايه|\bhow much\b/iu.test(question);
}

export function asksReferralFollowUp(input: string): boolean {
  const text = normalizeArabic(input);
  return /خدم[هة]\s+العملاء|اتواصل\s+مع\s+مين|(?:اتاكد|اسال|اراجع|استفسر)\s+من\s+مين|(?:على\s+حسابي|من\s+جيبي)|\b(?:customer service|who (?:do|should) i (?:ask|contact)|pay out of pocket)\b/iu.test(text);
}

export function asksAboutExclusion(input: string): boolean {
  return /مستبعد|استبعاد|(?:مش|غير)\s+مغط[ىي]|\b(?:excluded|exclusion|not covered)\b/iu.test(normalizeArabic(input));
}

export function explicitlyRefersToSameProcedure(input: string): boolean {
  return /(?<!\p{L})(?:نفس\s+(?:ال)?(?:فحص|تحليل|اشع[هة]|خدم[هة])|(?:ال)?(?:فحص|تحليل|اشع[هة]|خدم[هة])\s+(?:نفسه|نفسها))(?!\p{L})|\b(?:the same (?:test|scan|procedure|service))\b/iu.test(normalizeArabic(input));
}

export function isServiceSelection(input: string, code: ServiceCode): boolean {
  const remainder = coverageSubjectText(input).replace(CATALOG_NAMES[code], " ")
    .replace(/^\s*(?:المغناطيسي|السيني[هة])(?=\s|[؟?!.،,]|$)/u, "").replace(/[؟?!.،,]/gu, " ").trim();
  return /^(?:(?:طب|طيب|ابد[اأ]|ابد[اأ]ي|قصدي|اقصد|بتكلم|بسال|اسال|على|عن|ب|في|نفسه)\s*)*$/u.test(remainder);
}

/** Accept a replacement only when the abandoned referent is the current general topic. */
export function correctedServiceSelection(input: string): ServiceCode | undefined {
  const correction = /^(?:(?:لا|بس|لكن)\s*[،,]?\s*|كنت\s+)?(?:اقصد|قصدي)\s+(.+?)\s+بدل\s+(?:ال)?(?:تحليل|فحص|تصوير)\s*[؟?!.]*$/u.exec(normalizeArabic(input).trim());
  if (!correction) return undefined;
  const [, replacement] = correction;
  const { named, unsupported, comparison } = inspectServiceSubject(replacement);
  return named.length === 1 && !unsupported && !comparison && isServiceSelection(replacement, named[0]) ? named[0] : undefined;
}

/** Verify a model proposal against positive, unambiguous evidence in user text. */
export function isGroundedCoverageService(input: string, proposed: ServiceCode): boolean {
  const question = coverageSubjectText(input);
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
