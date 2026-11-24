const identify = document.querySelector("#identify");
const verify = document.querySelector("#verify");
const chat = document.querySelector("#chat");
const ask = document.querySelector("#ask");
const member = document.querySelector("#member");
const otp = document.querySelector("#otp");
const question = document.querySelector("#question");
const logout = document.querySelector("#logout");
const fixtures = document.querySelector("#fixtures");
const picks = document.querySelectorAll(".pick");
const suggestions = document.querySelectorAll(".suggestion");
const stageHeading = document.querySelector("#stage");
const status = document.querySelector("#status");
const error = document.querySelector("#error");
const messages = document.querySelector("#messages");
const challenges = "/v1/member-auth/challenges";
const opaqueId = /^[A-Za-z0-9_-]{43}$/;
const failure = "في مشكلة في الاتصال بخدمة التجربة. جرّب تاني بعد شوية.";
const expired = "انتهت الجلسة أو بقت غير صالحة. اتحقق برقم العضوية من جديد.";
const chatTimeoutMs = Number(ask.dataset.chatTimeoutMs);
const stages = {
  identify: { panel: identify, title: "ابدأ برقم العضوية", input: member },
  verify: { panel: verify, title: "تحقق من العضوية", input: otp },
  chat: { panel: chat, title: "محادثة التغطية", input: question }
};

let stage = "identify";
let challengeId = "";
let session;
let expiryTimer;
let pending;

function updateControls() {
  for (const control of document.querySelectorAll(".journey input, .journey button, .pick")) {
    control.disabled = Boolean(pending);
  }
}

function showStage(next) {
  stage = next;
  for (const [key, { panel }] of Object.entries(stages)) {
    panel.hidden = key !== next;
    const step = document.querySelector("#" + key + "-step");
    if (key === next) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  }
  stageHeading.textContent = stages[next].title;
  logout.hidden = next !== "chat";
  fixtures.hidden = next === "chat";
  for (const pick of picks) pick.hidden = next !== "identify";
  status.textContent = "";
  error.textContent = "";
}

function clearSession() {
  pending?.abort();
  pending = undefined;
  clearTimeout(expiryTimer);
  session = undefined;
  challengeId = "";
  identify.reset();
  verify.reset();
  otp.removeAttribute("aria-invalid");
  ask.reset();
  messages.replaceChildren();
  showStage("identify");
  updateControls();
}

function endSession() {
  clearSession();
  error.textContent = expired;
  member.focus();
}

function hasActiveSession() {
  if (session && session.expiresAt > Date.now()) return true;
  endSession();
  return false;
}

async function post(path, body, signal, token) {
  const headers = { "content-type": "application/json" };
  if (token) headers["x-demo-session"] = token;
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal
  });
  return { status: response.status, data: await response.json() };
}

async function runRequest(loading, action, onFailure = failure, timeoutMs = 8_000) {
  if (pending) return;
  const initialStage = stage;
  const controller = new AbortController();
  let completeMessage;
  pending = controller;
  updateControls();
  status.textContent = loading;
  error.textContent = "";
  try {
    completeMessage = await action(AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]));
  } catch {
    if (pending === controller) error.textContent = onFailure;
  } finally {
    if (pending === controller) {
      pending = undefined;
      status.textContent = completeMessage ?? "";
      updateControls();
      if (stage !== initialStage || document.activeElement === document.body) stages[stage].input.focus();
    }
  }
}

function appendMessage(author, content) {
  const message = document.createElement("li");
  message.className = author === "member" ? "message member" : "message";
  const name = document.createElement("strong");
  name.textContent = author === "member" ? "أنت" : "رد المحاكاة";
  const text = document.createElement("p");
  text.dir = "auto";
  text.textContent = content;
  message.append(name, text);
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
}

for (const pick of picks) {
  pick.addEventListener("click", () => {
    member.value = pick.value;
    member.focus();
  });
}

identify.addEventListener("submit", (event) => {
  event.preventDefault();
  const memberIdentifier = member.value.trim();
  if (!/^M-DEMO-[0-9]{3}$/i.test(memberIdentifier)) {
    error.textContent = "اكتب رقم عضوية تجريبي بالصيغة M-DEMO-001.";
    member.focus();
    return;
  }
  void runRequest("جاري تجهيز التحقق…", async (signal) => {
    const reply = await post(challenges, { memberIdentifier }, signal);
    if (signal.aborted) return;
    if (reply.status !== 202 || !opaqueId.test(reply.data.challengeId)) throw new Error();
    challengeId = reply.data.challengeId;
    showStage("verify");
  });
});

verify.addEventListener("submit", (event) => {
  event.preventDefault();
  const oneTimeCode = otp.value;
  void runRequest("جاري التحقق من الرمز…", async (signal) => {
    const reply = await post(challenges + "/" + challengeId + "/verify", { oneTimeCode }, signal);
    if (signal.aborted) return;
    otp.value = "";
    if (reply.status === 401) {
      otp.setAttribute("aria-invalid", "true");
      error.textContent = "التحقق ما تمّش. راجع الرمز. لو المحاولة انتهت، ارجع لرقم العضوية وابدأ من جديد بعد شوية.";
      return;
    }
    const expiresAt = Date.parse(reply.data.sessionExpiresAt);
    if (reply.status !== 200 || !opaqueId.test(reply.data.sessionToken) || !Number.isFinite(expiresAt)) throw new Error();
    session = { token: reply.data.sessionToken, expiresAt };
    challengeId = "";
    if (!hasActiveSession()) return;
    expiryTimer = setTimeout(endSession, expiresAt - Date.now());
    showStage("chat");
    appendMessage("demo", "تم التحقق. اسأل عن الرنين المغناطيسي أو صورة الدم الكاملة أو الأشعة السينية.");
  });
});

otp.addEventListener("input", () => otp.removeAttribute("aria-invalid"));
document.querySelector("#back").addEventListener("click", () => {
  challengeId = "";
  verify.reset();
  otp.removeAttribute("aria-invalid");
  showStage("identify");
  status.textContent = "لو طلبت التحقق من نفس الحساب، استنى ٣٠ ثانية بين الطلبات.";
  member.focus();
});

for (const suggestion of suggestions) {
  suggestion.addEventListener("click", () => {
    question.value = suggestion.textContent;
    question.focus();
  });
}

ask.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!hasActiveSession()) return;
  const message = question.value.trim();
  if (!message) {
    error.textContent = "اكتب سؤال عن التغطية الأول.";
    question.focus();
    return;
  }
  void runRequest("جاري الاستعلام عن التغطية…", async (signal) => {
    const reply = await post("/v1/chat", { message }, signal, session.token);
    if (signal.aborted) return;
    if (!hasActiveSession()) return;
    if (reply.status === 401) {
      endSession();
      return;
    }
    if (reply.status !== 200 || typeof reply.data.answer !== "string") {
      error.textContent = "تعذّر الاستعلام عن التغطية دلوقتي. جرّب إرسال السؤال تاني.";
      return;
    }
    appendMessage("member", message);
    appendMessage("demo", reply.data.answer);
    question.value = "";
  }, failure, chatTimeoutMs);
});

logout.addEventListener("click", () => {
  if (pending || !hasActiveSession()) return;
  const { token } = session;
  clearSession();
  void runRequest("جاري تسجيل الخروج…", async (signal) => {
    const reply = await post("/v1/member-auth/logout", {}, signal, token);
    if (signal.aborted) return;
    if (reply.status !== 200 || reply.data.sessionRevoked !== true) throw new Error();
    return "تم تسجيل الخروج.";
  }, "اتمسحت الجلسة من الصفحة. تعذّر تأكيد تسجيل الخروج من الخادم.");
});

window.addEventListener("pagehide", clearSession);
updateControls();
