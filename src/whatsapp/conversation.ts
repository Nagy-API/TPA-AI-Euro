import { ConversationExperiment } from "../conversation-experiment.ts";
import type { ConversationProvider } from "../conversation-provider.ts";
import { CHAT_REQUEST_TIMEOUT_MS } from "../contracts.ts";
import { CoverageAssistant } from "../coverage-assistant.ts";
import { hasPrivateCoverageInput, normalizeArabic } from "../coverage-input.ts";
import { DemoMemberAuth } from "../demo-auth/member-auth.ts";
import { DemoKeywordSelector } from "../demo-selector.ts";
import { MockTpaBackend } from "../mock-backend.ts";

const START = "دي تجربة ببيانات وهمية. ابدأ بـ login M-DEMO-XXX واستبدل XXX برقم حساب الاختبار من دليل التشغيل.";
const VERIFY = "لو التحقق متاح، ابعت verify وبعدها كود الاختبار من دليل التشغيل. لو فاتت دقيقتين ابدأ تاني بـ login.";
const FAILED = "التحقق فشل أو انتهت صلاحيته. راجع كود الاختبار أو ابدأ من جديد باستخدام login.";
export const WHATSAPP_RETRY = "الخدمة التجريبية مش متاحة دلوقتي. جرّب تبعت سؤالك مرة تانية.";
const PRIVATE_CHAT_LABEL = /\b(?:(?:verification|security|login|confirmation|authentication|access|one[- ]time) (?:code|pin|number)|(?:phone|mobile|cell|whatsapp|contact) (?:no\.?|number)|(?:member(?:ship)?|customer|patient|policy|account|insurance|tenant|card) (?:id|identifier|reference|number))\b|(?<!\p{L})(?:رقم(?:ي|نا)|(?:كود|رمز) (?:الدخول|التاكيد|التفعيل)|رقم (?:الواتساب|واتساب)|معرف (?:العضو|العضوية|الحساب|الوثيقة))(?!\p{L})/iu;
const DIGIT_WORDS = new Set([
  "zero", "oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "صفر", "واحد", "اتنين", "اثنين", "اثنان", "تلاتة", "ثلاثة", "تلات", "ثلاث", "اربعة", "اربع",
  "خمسة", "خمس", "ستة", "ست", "سبعة", "سبع", "تمانية", "ثمانية", "تماني", "ثماني", "تسعة", "تسع"
]);

type ChannelIdentity = { challengeId: string; challengedAt: number } | { sessionToken: string; verifiedAt: number };
type Reply = { text: string; sessionSignal?: AbortSignal };

function containsPrivateData(text: string): boolean {
  if (/\p{N}/u.test(text) || hasPrivateCoverageInput(text)) return true;
  const normalized = normalizeArabic(text).toLowerCase();
  if (PRIVATE_CHAT_LABEL.test(normalized)) return true;
  let digitWords = 0;
  for (const word of normalized.match(/\p{L}+/gu) ?? []) {
    if (DIGIT_WORDS.has(word) || (word.startsWith("و") && DIGIT_WORDS.has(word.slice(1)))) {
      if (++digitWords >= 6) return true;
    }
  }
  return false;
}

export class WhatsAppConversation {
  private readonly auth: DemoMemberAuth;
  private readonly assistant: CoverageAssistant;
  // Only signed, configured senders reach this map. The web process owns a different auth store.
  private readonly identities = new Map<string, ChannelIdentity>();

  constructor(provider: ConversationProvider, now: () => number) {
    this.auth = new DemoMemberAuth(now);
    this.assistant = new CoverageAssistant(
      new MockTpaBackend(this.auth), new DemoKeywordSelector(), this.auth, undefined, new ConversationExperiment(provider)
    );
  }

  async reply(sender: string, text: string, sentAt: number): Promise<Reply> {
    const identity = this.identities.get(sender);
    const command = text.split(" ", 1)[0].toLowerCase();
    if (command === "help") {
      return { text: START + "\n" + VERIFY + "\nابعت logout لإنهاء الجلسة أو login مع حساب تجريبي تاني للتبديل." };
    }
    if (command === "logout") {
      this.revoke(identity);
      this.identities.delete(sender);
      return { text: "تم تسجيل الخروج. " + START };
    }
    if (command === "login") {
      const identifier = /^login (M-DEMO-[0-9]{3})$/i.exec(text)?.[1];
      if (!identifier) return { text: START };
      this.revoke(identity);
      this.identities.set(sender, { challengeId: this.auth.identify(identifier).challengeId, challengedAt: sentAt });
      return { text: VERIFY };
    }
    if (command === "verify") {
      if (!identity || !("challengeId" in identity)) return { text: FAILED };
      if (sentAt <= identity.challengedAt) return { text: "ابعت كود التحقق تاني بعد رسالة بدء التحقق." };
      const code = /^verify ([0-9]{6})$/i.exec(text)?.[1];
      const verified = this.auth.verify(identity.challengeId, code);
      if (!verified) return { text: FAILED };
      this.identities.set(sender, { sessionToken: verified.sessionToken, verifiedAt: sentAt });
      return { text: "تم التحقق من الحساب التجريبي. اسأل عن التغطية. الجلسة مدتها عشر دقايق." };
    }

    if (!identity) return { text: START };
    if ("challengeId" in identity) return { text: VERIFY };
    const session = this.auth.resolveSession(identity.sessionToken);
    if (!session) {
      this.identities.delete(sender);
      return { text: START };
    }
    // Meta timestamps have one-second precision. A turn in the verification second has ambiguous scope.
    if (sentAt <= identity.verifiedAt) return { text: "ابعت سؤالك تاني بعد تأكيد التحقق من الحساب التجريبي." };
    if (text.length > 500) return { text: "اكتب سؤال عن الخدمة الطبية في 500 حرف أو أقل." };
    if (containsPrivateData(text)) {
      return { text: "اكتب سؤالك من غير أرقام أو بيانات عضوية أو تحقق." };
    }
    const reply = await this.assistant.answer(
      identity.sessionToken, text, AbortSignal.timeout(CHAT_REQUEST_TIMEOUT_MS), Date.now() + CHAT_REQUEST_TIMEOUT_MS
    );
    const remaining = this.auth.remainingSessionMs(session);
    if (remaining <= 0 || !this.auth.isActive(session) || reply.code === "VERIFICATION_REQUIRED") {
      this.identities.delete(sender);
      return { text: START };
    }
    return {
      text: reply.answer,
      sessionSignal: AbortSignal.any([this.auth.conversationSignal(session), AbortSignal.timeout(remaining)])
    };
  }

  private revoke(identity?: ChannelIdentity): void {
    if (identity && "sessionToken" in identity) this.auth.revokeSession(identity.sessionToken);
  }
}
