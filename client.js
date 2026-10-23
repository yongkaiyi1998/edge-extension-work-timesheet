export async function api(op, args = {}) {
  if (op === "template")
    args = { ...args, bytes: Array.from(new Uint8Array(args.bytes)) };
  const r = await chrome.runtime.sendMessage({ op, ...args });
  if (r.error) throw Error(r.error);
  return r.value;
}
export const $ = (s) => document.querySelector(s);
export function el(tag, text, attrs = {}) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  Object.assign(e, attrs);
  return e;
}
export function message(text, error = false) {
  const e = $("#message");
  e.textContent = text;
  e.className = error ? "error" : "success";
  const dialog = $("dialog[open]");
  if (dialog) {
    let notice = dialog.querySelector(".dialog-message");
    if (!notice) {
      notice = el("p");
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");
      dialog.prepend(notice);
    }
    notice.className = `dialog-message ${error ? "error" : "success"}`;
    notice.textContent = text;
  }
}
export function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = el("a", "", { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function action(fn) {
  return async (e) => {
    const b = e?.currentTarget;
    if (b) b.disabled = true;
    try {
      await fn(e);
    } catch (err) {
      message(err.message, true);
    } finally {
      if (b) b.disabled = false;
    }
  };
}
