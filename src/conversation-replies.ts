import { SERVICE_CATALOG, type ConversationIntent, type Focus, type TurnResolution } from "./conversation-intent.ts";
import type { Coverage } from "./contracts.ts";

export const OTHER_ACCOUNT = "أقدر أراجع تغطية حسابك التجريبي الحالي بس. صاحب الحساب التاني يقدر يسأل من جلسته بعد التحقق.";
export const UNSUPPORTED_SERVICE = "الخدمة دي مش ضمن الخدمات اللي أقدر أراجعها في الديمو. ده ما يحددش إذا كانت وثيقتك بتغطيها. اسأل خدمة العملاء عن الخدمة دي.";
export const CLARIFY_SERVICE = "ممكن تقول اسم الفحص اللي الدكتور طلبه أو توصف بيتعمل إزاي؟";
export const CUSTOMER_SERVICE_CONTACT = "رقم خدمة العملاء مش متاح عندي في الشات، والتحويل لموظف مش متاح هنا. راجع بيانات التواصل في وثيقة التأمين أو على كارت التأمين لو مكتوبة عليه. لو بتسأل عن فحص، اسألهم عن تغطيته وهل محتاج موافقة مسبقة.";
const limitFormatter = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 21 });

export function formatRemainingLimit(amount: number): string {
  return limitFormatter.format(amount);
}

export function explainConversation(purpose: Extract<TurnResolution, { action: "explain" }>["purpose"]) {
  if (purpose === "approval-action") return {
    code: "OUT_OF_SCOPE",
    answer: "إصدار الموافقة أو تعديل الوثيقة من اختصاص الجهة المختصة. أقدر أراجع شرط الموافقة في الوثيقة التجريبية لو عايز تستفسر عنه."
  };
  if (purpose === "unsupported") return { code: "UNSUPPORTED_SERVICE", answer: UNSUPPORTED_SERVICE };
  if (purpose === "clarify-policy-tier") return {
    code: "CLARIFICATION_NEEDED", answer: "تقصد فئة وثيقة التأمين بتاعتك؟"
  };
  if (purpose === "policy-tier") return {
    code: "OUT_OF_SCOPE", answer: "فئة وثيقتك مش متاحة في الشات ده. تقدر تراجعها في وثيقتك أو مع خدمة العملاء."
  };
  if (purpose === "member-name") return {
    code: "OUT_OF_SCOPE", answer: "اسمك المسجّل مش متاح في بيانات الشات ده."
  };
  if (purpose === "nearest-branch") return {
    code: "OUT_OF_SCOPE", answer: "مواقع الفروع ومواعيد مقدمي الخدمة مش متاحة في الشات ده. تقدر تسأل خدمة العملاء عن أقرب فرع ليك أو عن المواعيد."
  };
  return {
    code: "OUT_OF_SCOPE",
    answer: `${CUSTOMER_SERVICE_CONTACT} غياب النتيجة هنا ما يحددش اللي هتدفعه.`
  };
}

export const FAQ_DEFINITIONS = {
  COPAY: "نسبة التحمل هي الجزء اللي عليك من تكلفة الخدمة المؤهلة للتغطية. النسبة بتختلف حسب الخدمة والوثيقة.",
  LIMIT: "الحد المتبقي هو الجزء اللي لسه متاح من حد التغطية في الوثيقة. المبلغ اللي عليك بيتحدد من تكلفة الخدمة وشروط التغطية.",
  PREAPPROVAL: "الموافقة المسبقة معناها إن الجهة المختصة لازم تراجع طلب الخدمة قبل تقديمها، حسب شروط الوثيقة."
};

export function conversationReply({ intent, subject }: ConversationIntent) {
  switch (intent) {
    case "CAPABILITIES":
      return {
        code: intent,
        answer: subject === "SERVICES"
          ? `في الديمو أقدر أراجع ${Object.values(SERVICE_CATALOG).map(({ name }) => name).join("، ")}. نتيجة كل فحص بتعتمد على بيانات الوثيقة التجريبية.`
          : "أقدر أراجع تغطية فحص في وثيقتك التجريبية، وأقولك نسبة التحمل والحد المتبقي ولو محتاج موافقة مسبقة، حسب البيانات المتاحة."
      };
    case "FAQ":
      if (subject === "COPAY" || subject === "LIMIT" || subject === "PREAPPROVAL") {
        return { code: intent, answer: FAQ_DEFINITIONS[subject] };
      }
      break;
    case "UNSUPPORTED_SERVICE":
      return { code: intent, answer: UNSUPPORTED_SERVICE };
    case "OUT_OF_SCOPE":
      return { code: intent, answer: subject === "THIRD_PARTY" ? OTHER_ACCOUNT :
        "أقدر أساعدك في استفسارات التغطية ومعاني مصطلحات التأمين في الديمو. قول لي اسم الفحص أو المصطلح اللي حابب تعرف عنه." };
    case "FOLLOW_UP":
      return { code: "CLARIFICATION_NEEDED", answer: "بتسأل عن أنهي فحص؟ قول لي اسم الفحص عشان أراجع بياناته في وثيقتك التجريبية." };
  }
  return { code: "CLARIFICATION_NEEDED", answer: subject === "MULTIPLE"
    ? "خلّينا نراجع فحص واحد في كل مرة. تحب نبدأ بأنهي واحد؟" : CLARIFY_SERVICE };
}

export function formatFocusedCoverage(coverage: Coverage, focus: Focus): string | undefined {
  const name = SERVICE_CATALOG[coverage.serviceCode].name;
  const demo = " (بيانات تجريبية)";
  if (coverage.coverageStatus === "UNKNOWN") {
    return `بيانات تغطية ${name} مش متاحة في الديمو للوثيقة دي. اسأل خدمة العملاء عن التغطية.${demo}`;
  }
  if (coverage.coverageStatus === "NOT_COVERED" || focus === "OVERVIEW") return undefined;
  const conditions = focus !== "PREAPPROVAL" && coverage.requiresPreApproval === true
    ? " التغطية مشروطة بموافقة مسبقة من الجهة المختصة قبل تقديم الخدمة."
    : coverage.coverageStatus === "COVERED_WITH_CONDITIONS" ? " التغطية مشروطة." : "";
  if (focus === "COPAY") {
    return coverage.copayPercent === null
      ? `نسبة التحمل لـ${name} مش متاحة في بيانات الوثيقة.${conditions}${demo}`
      : `بالنسبة لـ${name}، نسبة التحمل ${coverage.copayPercent}% من التكلفة المؤهلة. المبلغ بالجنيه محتاج سعر الخدمة.${conditions}${demo}`;
  }
  if (focus === "LIMIT") {
    return coverage.remainingLimit === null
      ? `الحد المتبقي لـ${name} مش متاح في بيانات الوثيقة.${conditions}${demo}`
      : `الحد المتبقي لـ${name} هو ${formatRemainingLimit(coverage.remainingLimit)} جنيه.${conditions}${demo}`;
  }
  if (coverage.requiresPreApproval === null) return `شرط الموافقة المسبقة لـ${name} مش معروف من بيانات الوثيقة.${conditions}${demo}`;
  return coverage.requiresPreApproval
    ? `${name} محتاج موافقة مسبقة من الجهة المختصة قبل تقديم الخدمة.${conditions}${demo}`
    : `الوثيقة التجريبية ما بتشترطش موافقة مسبقة لـ${name}.${conditions}${demo}`;
}
