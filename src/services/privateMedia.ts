import * as Crypto from "expo-crypto";
import { requestBlob, API_BASE } from "./api";
import { supabase } from "./auth";
import { trustedApiUrl } from "../domain/contracts";
import type { Bundle } from "../domain/types";
const image = /^data:image\/(?:png|jpeg|webp|gif);base64,/;
export async function preparePrivateMedia(owner: string, bundle: Bundle) {
  if (!bundle.sourceSessionId) return bundle;
  if (bundle.ownerId && bundle.ownerId !== owner)
    throw new Error("This material belongs to another account.");
  const result: Bundle = {
      ...bundle,
      assets: { ...bundle.assets },
      questions: bundle.questions.map((q) => ({
        ...q,
        figures: q.figures?.map((f) => ({ ...f })),
        optionsHtml: q.optionsHtml ? [...q.optionsHtml] : undefined,
      })),
    },
    images = new Map<string, Promise<string>>();
  async function assetReference(data: string) {
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data,
    );
    const comma = data.indexOf(",");
    result.assets![key] = {
      mime: data.slice(5, data.indexOf(";")),
      data: data.slice(comma + 1),
    };
    return "pastq-asset:" + key;
  }
  async function load(value: string) {
    if (image.test(value)) return assetReference(value);
    const url = trustedApiUrl(value, API_BASE);
    if (!url || !new URL(url).pathname.startsWith("/api/library/figures/"))
      return value;
    if (!images.has(url))
      images.set(
        url,
        (async () => {
          if (
            (await supabase?.auth.getSession())?.data.session?.user.id !== owner
          )
            throw new Error("Sign in to save your private diagrams.");
          const blob = await requestBlob(
            new URL(url).pathname,
            { owner },
            true,
          );
          if (
            !/^image\/(png|jpeg|webp|gif)$/.test(blob.type) ||
            blob.size <= 0 ||
            blob.size > 20 * 1048576
          )
            throw new Error("Invalid diagram data.");
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () =>
              reject(new Error("Could not read a diagram."));
            reader.readAsDataURL(blob);
          });
          if (!image.test(data))
            throw new Error("A diagram could not be saved.");
          return assetReference(data);
        })(),
      );
    return images.get(url)!;
  }
  for (const q of result.questions) {
    for (const figure of q.figures || []) {
      if (figure.url) figure.url = await load(figure.url);
      if (figure.src) figure.src = await load(figure.src);
    }
    for (const field of [
      "questionHtml",
      "explanationHtml",
      "answerHtml",
      "passage",
    ] as const) {
      const html = q[field];
      if (typeof html === "string") {
        let next = html;
        for (const match of html.matchAll(/\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
          const data = await load(match[2]);
          if (data !== match[2])
            next = next.replace(match[0], "src=" + match[1] + data + match[1]);
        }
        q[field] = next;
      }
    }
    if (q.optionsHtml)
      q.optionsHtml = await Promise.all(
        q.optionsHtml.map(async (html) => {
          let next = html;
          for (const match of html.matchAll(/\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
            const data = await load(match[2]);
            if (data !== match[2])
              next = next.replace(
                match[0],
                "src=" + match[1] + data + match[1],
              );
          }
          return next;
        }),
      );
  }
  if ((await supabase?.auth.getSession())?.data.session?.user.id !== owner)
    throw new Error("Your account changed. Reopen this material.");
  return { ...result, ownerId: owner };
}
