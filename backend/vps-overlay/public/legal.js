import fs from "node:fs";
export const legalContent = JSON.parse(
  fs.readFileSync(new URL("./legal-content.json", import.meta.url), "utf8"),
);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function legalPage(kind) {
  const titles = {
    privacy: "Privacy policy",
    terms: "Terms of use",
    "delete-account": "Delete your account",
    support: "Help & privacy",
  };
  const title = titles[kind];
  if (!title) return null;
  const sections =
    kind === "privacy"
      ? legalContent.privacy
      : kind === "terms"
        ? legalContent.terms
        : kind === "delete-account"
          ? legalContent.deletion
          : [];
  const subject =
    kind === "delete-account"
      ? "focalPoint account deletion"
      : "focalPoint support";
  const mail =
    "mailto:" +
    legalContent.supportEmail +
    "?subject=" +
    encodeURIComponent(subject);
  const paragraphs = sections
    .map(
      (s) =>
        "<section><h2>" +
        escape(s.title) +
        "</h2><p>" +
        escape(s.body) +
        "</p></section>",
    )
    .join("");
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escape(title) +
    ' · focalPoint</title><style>body{margin:0;background:#151515;color:#eee9e2;font:17px/1.7 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:40px 22px 70px}a{color:#d8a38d;overflow-wrap:anywhere}nav{display:flex;gap:18px;flex-wrap:wrap;margin:30px 0}nav a{min-height:44px;display:inline-flex;align-items:center}.brand{font-size:26px;font-weight:800;letter-spacing:-1px}h1{font-size:34px;line-height:1.2;margin:32px 0 22px}h2{font-size:21px;margin:30px 0 8px}p{margin:8px 0 18px}.button{display:inline-block;border:1px solid #c7927d;border-radius:8px;padding:12px 20px;margin:16px 0;text-decoration:none}.date{font-size:14px;color:#b5aaa0}</style></head><body><main><div class="brand">focal<span style="color:#c7927d">Point</span></div><h1>' +
    escape(title) +
    "</h1>" +
    paragraphs +
    '<a class="button" href="' +
    escape(mail) +
    '">' +
    (kind === "delete-account" ? "Request account deletion" : "Email support") +
    '</a><p><a href="mailto:' +
    escape(legalContent.supportEmail) +
    '">' +
    escape(legalContent.supportEmail) +
    '</a></p><nav aria-label="Policies"><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/delete-account">Delete account</a></nav><p class="date">Updated ' +
    escape(legalContent.updated) +
    "</p></main></body></html>"
  );
}
export function legalPages(req, res, next) {
  const match = /^\/legal\/(privacy|terms|delete-account|support)\/?$/.exec(
    req.path,
  );
  if (!match) return next();
  res.set({
    "Cache-Control": "public, max-age=300",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  });
  return res.type("html").send(legalPage(match[1]));
}
