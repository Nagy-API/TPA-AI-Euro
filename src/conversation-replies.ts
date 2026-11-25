import { SERVICE_CATALOG, type ConversationIntent, type Focus, type TurnResolution } from "./conversation-intent.ts";
import type { Coverage } from "./contracts.ts";

export const OTHER_ACCOUNT = "أقدر أراجع تغطية حسابك التجريبي الحالي بس. صاحب الحساب التاني يقدر يسأل من جلسته بعد التحقق.";
export const UNSUPPORTED_SERVICE = "الخدمة دي مش ضمن الخدمات اللي أقدر أراجعها في الديمو. ده ما يحددش إذا كانت وثيقتك بتغطيها. اسأل خدمة العملاء عن الخدمة دي.";
export const CLARIFY_SERVICE = "ممكن تقول اسم الفحص اللي الدكتور طلبه أو توصف بيتعمل إزاي؟";

export function explainConversation(purpose: Extract<TurnResolution, { action: "explain" }>["purpose"]) {
  if (purpose === "approval-action") return {
    code: "OUT_OF_SCOPE",
    answer: "إصدار الموافقة أو تعديل الوثيقة من اختصاص الجهة المختصة. أقدر أراجع شرط الموافقة في الوثيقة التجريبية لو عايز تستفسر عنه."
  };
  if (purpose === "unsupported") return { code: "UNSUPPORTED_SERVICE", answer: UNSUPPORTED_SERVICE };
  return {
    code: "OUT_OF_SCOPE",
    answer: "اتأكد من خدمة العملاء أو الجهة المسؤولة عن وثيقتك قبل المعاد. اسألهم عن تغطية الخدمة وأي شرط للموافقة. غياب النتيجة هنا ما يحددش اللي هتدفعه."
  };
}

const FAQ = {
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
      if (subject === "COPAY" || subject === "LIMIT" || subject === "PREAPPROVAL") return { code: intent, answer: FAQ[subject] };
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
  if (focus === "COPAY") {
    return coverage.copayPercent === null
      ? `نسبة التحمل لـ${name} مش متاحة في بيانات الوثيقة.${demo}`
      : `بالنسبة لـ${name}، نسبة التحمل ${coverage.copayPercent}% من التكلفة المؤهلة. المبلغ بالجنيه محتاج سعر الخدمة.${demo}`;
  }
  if (focus === "LIMIT") {
    return coverage.remainingLimit === null
      ? `الحد المتبقي لـ${name} مش متاح في بيانات الوثيقة.${demo}`
      : `الحد المتبقي لـ${name} هو ${coverage.remainingLimit.toLocaleString("en-US")} جنيه.${demo}`;
  }
  if (coverage.requiresPreApproval === null) return `شرط الموافقة المسبقة لـ${name} مش معروف من بيانات الوثيقة.${demo}`;
  return coverage.requiresPreApproval
    ? `${name} محتاج موافقة مسبقة من الجهة المختصة قبل تقديم الخدمة.${demo}`
    : `الوثيقة التجريبية ما بتشترطش موافقة مسبقة لـ${name}.${demo}`;
}
