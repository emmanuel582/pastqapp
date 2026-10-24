import sanitizeHtml from "sanitize-html";
import katex from "katex";
import { mathCss } from "../data/mathCss";
import type { Asset } from "../domain/types";
import type { Palette } from "../theme/tokens";
import { API_BASE } from "./api";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function contentHtml(
  text: string,
  html: string | undefined,
  assets: Record<string, Asset> | undefined,
) {
  const source =
    html ||
    escape(text)
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  const clean = sanitizeHtml(source, {
    allowedTags: [
      "p",
      "div",
      "span",
      "br",
      "em",
      "strong",
      "b",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "ul",
      "ol",
      "li",
      "img",
      "blockquote",
      "hr",
    ],
    allowedAttributes: {
      "*": ["style"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|center|right)$/],
        "font-style": [/^(normal|italic)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "text-decoration": [/^(underline|line-through)$/],
      },
    },
    allowedSchemes: ["data", "https"],
    allowedSchemesByTag: { img: ["data", "https"] },
    transformTags: {
      span: (_tag, attribs) => {
        const style = attribs.style || "";
        const top = style.match(/(?:^|;)\s*top\s*:\s*(-?\d+(?:\.\d+)?)px/i);
        const superscript =
          /vertical-align\s*:\s*(super|sup)/i.test(style) ||
          (top && Number(top[1]) < 0);
        const subscript = /vertical-align\s*:\s*sub/i.test(style);
        return {
          tagName: superscript ? "sup" : subscript ? "sub" : "span",
          attribs,
        };
      },
      img: (_tag, attribs) => {
        let src = attribs.src || "";
        const key = src.match(/^pastq-asset:([a-f0-9]{64})$/)?.[1];
        if (key) {
          const asset = assets?.[key];
          src = asset ? "data:" + asset.mime + ";base64," + asset.data : "";
        } else if (src.startsWith("/") && !src.startsWith("//"))
          src = API_BASE + src;
        return { tagName: "img", attribs: { ...attribs, src } };
      },
    },
  });
  return clean.replace(
    /\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$|\\\[([\s\S]*?)\\\]|\\\((.*?)\\\)/g,
    (_m, a, b, c, d) => {
      try {
        return katex.renderToString(a || b || c || d, {
          throwOnError: false,
          displayMode: !!(a || c),
          trust: false,
          output: "html",
        });
      } catch {
        return escape(_m);
      }
    },
  );
}
export function richDocument(
  content: string,
  palette: Palette,
  size: number,
  serif: boolean,
) {
  return (
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';img-src data: https:;font-src data:;style-src \'unsafe-inline\';script-src \'nonce-pastq-measure\'"><style>' +
    mathCss +
    "html,body{margin:0;padding:0;background:transparent;color:" +
    palette.ink +
    ";font-family:" +
    (serif ? "Lora" : "Manrope") +
    ";font-size:" +
    size +
    "px;line-height:1.65;overflow-wrap:anywhere}body{padding-bottom:1px}p{margin:0 0 10px}p:last-child{margin-bottom:0}img{max-width:100%;height:auto;max-height:360px;object-fit:contain;background:#fff;padding:8px;border-radius:6px;box-sizing:border-box}table{max-width:100%;border-collapse:collapse}td,th{padding:5px;border:1px solid " +
    palette.line +
    "}.katex-display{max-width:100%;overflow-x:auto;overflow-y:hidden}.katex{font-size:1.1em}</style></head><body>" +
    content +
    '<script nonce="pastq-measure">let last=0;function report(){let h=Math.ceil(document.body.getBoundingClientRect().height);if(h!==last){last=h;window.ReactNativeWebView?.postMessage(String(h));}}new ResizeObserver(report).observe(document.body);window.addEventListener("load",report);document.fonts.ready.then(report);report();</script></body></html>'
  );
}
