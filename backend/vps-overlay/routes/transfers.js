import { ingestTransferredPdf } from "../services/vision/transferPdf.js";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { TransferStore, PART_BYTES } from "../services/vision/transfers.js";
import {
  requireAuthenticatedUser,
  ownsSession,
} from "../services/auth/middleware.js";
import {
  getSession,
  pageDir,
  listSessions,
  publicSession,
} from "../services/vision/store.js";
import * as pages from "../services/vision/pageStore.js";
import { savePageImage } from "../services/vision/image.js";
import { validatePdfBuffer } from "../services/vision/pdf.js";
import {
  withSessionLock,
  addTextPages,
  kickoffSession,
} from "../services/vision/processor.js";
const router = express.Router(),
  exec = promisify(execFile),
  pending = new Set();
let working = 0;
const running = new Set();
const store = (id) => new TransferStore(path.join(pageDir(id), "incoming"));
router.use(requireAuthenticatedUser);
router.get("/", (req, res) => {
  const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0),
    limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 30),
    );
  const rows = listSessions().filter((s) => s.ownerKey === req.auth.ownerKey);
  const items = rows
    .slice(offset, offset + limit)
    .map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      approvedAt: s.approvedAt || null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      questionCount: s.questions?.length || 0,
      openChecks:
        (s.followUps || []).filter((f) => f.status === "open").length +
        (s.questions || []).filter(
          (q) => q.needsReview || q.incomplete || q.type === "other",
        ).length,
    }));
  res
    .set("Cache-Control", "no-store")
    .json({
      items,
      total: rows.length,
      nextOffset: offset + limit < rows.length ? offset + limit : null,
    });
});
router.use("/:id", (req, res, next) => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(req.params.id))
    return res.status(400).json({ error: "Invalid upload." });
  const s = getSession(req.params.id);
  if (!s || !ownsSession(req, s))
    return res.status(404).json({ error: "Upload not found." });
  req.uploadSession = s;
  next();
});
router.post("/:id", async (req, res, next) => {
  try {
    const id = req.params.id,
      current = store(id).read();
    if (!current) {
      if (!["pending", "uploading"].includes(req.uploadSession.status))
        return res
          .status(409)
          .json({ error: "This material has already been uploaded." });
      let ownerActive = 0,
        totalBytes = 0;
      for (const s of listSessions()) {
        const file = path.join(pageDir(s.id), "incoming", "manifest.json");
        if (!fs.existsSync(file)) continue;
        const t = JSON.parse(fs.readFileSync(file, "utf8"));
        if (t.status === "accepted") continue;
        if (s.ownerKey === req.uploadSession.ownerKey) ownerActive++;
        totalBytes += t.files.reduce((n, f) => n + f.size, 0);
      }
      if (ownerActive >= 3 || totalBytes > 2 * 1024 * 1024 * 1024)
        return res.status(429).json({
          error: "Finish an existing upload before starting another.",
        });
    }
    const state = store(id).prepare(req.body?.files);
    await withSessionLock(id, (s) => {
      if (s.status === "pending") s.status = "uploading";
    });
    if (["ready", "failed", "processing"].includes(state.status)) {
      await withSessionLock(id, (s) => {
        s.status = "processing";
        s.followUps = (s.followUps || []).filter(
          (f) => f.type !== "transfer_failed",
        );
      });
      queue(id);
    }
    res.json(state);
  } catch (e) {
    if (e.status) res.status(e.status).json({ error: e.message });
    else next(e);
  }
});
router.get("/:id", (req, res) => {
  const value = store(req.params.id).read();
  res.status(value ? 200 : 404).json(value || { error: "Upload not found." });
});
router.put(
  "/:id/:file/:part",
  express.raw({ type: "application/octet-stream", limit: PART_BYTES }),
  (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.file) || !/^\d+$/.test(req.params.part))
        return res.status(400).json({ error: "Invalid part." });
      const state = store(req.params.id).put(
        Number(req.params.file),
        Number(req.params.part),
        req.body,
      );
      if (state.status === "ready") queue(req.params.id);
      res.json({ status: state.status, received: state.received });
    } catch (e) {
      if (e.status) res.status(e.status).json({ error: e.message });
      else next(e);
    }
  },
);
function queue(id) {
  if (!running.has(id)) pending.add(id);
  void drain();
}
async function convertOffice(source, folder) {
  const out = path.join(folder, "converted");
  fs.mkdirSync(out, { recursive: true });
  const pdf = path.join(
    out,
    path.basename(source, path.extname(source)) + ".pdf",
  );
  if (fs.existsSync(pdf)) return pdf;
  const profile = path.join(folder, "office-profile"),
    user = path.join(profile, "user");
  fs.mkdirSync(user, { recursive: true });
  // Disable macros and automatic external-link updates for uploaded documents.
  fs.writeFileSync(
    path.join(user, "registrymodifications.xcu"),
    '<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item></oor:items>',
  );
  await exec(
    "libreoffice",
    [
      "-env:UserInstallation=" + pathToFileURL(profile).href,
      "--headless",
      "--nologo",
      "--nodefault",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      out,
      source,
    ],
    {
      timeout: 90000,
      maxBuffer: 16384,
      env: { ...process.env, SAL_USE_VCLPLUGIN: "svp" },
    },
  );
  if (!fs.existsSync(pdf))
    throw Error("This document could not be read. Save it as PDF and retry.");
  return pdf;
}
async function ingest(id) {
  const t = store(id),
    state = t.read(),
    session = getSession(id);
  if (!session || !state || state.status === "accepted") return;
  if (
    !state.files.every((f, i) => state.received[i].length === f.hashes.length)
  )
    return;
  t.update({ status: "processing", error: null });
  const first = state.files[0];
  if (first.kind === "image") {
    for (let i = 0; i < state.files.length; i++) {
      const pageId = `${id}-transfer-${i}`;
      if (pages.getPage(pageId)) continue;
      const source = t.assemble(i),
        saved = await savePageImage(
          id,
          `transfer-${i}`,
          fs.readFileSync(source),
        );
      await withSessionLock(id, (s) => {
        if (!pages.getPage(pageId))
          pages.addPages(id, [
            {
              id: pageId,
              index: i,
              status: "pending",
              filename: state.files[i].name,
              imagePath: saved.fullPath,
              width: saved.original?.width || null,
              height: saved.original?.height || null,
              source: "image",
            },
          ]);
      });
    }
    await withSessionLock(id, (s) => {
      s.status = "processing";
    });
    kickoffSession(id);
  } else if (first.kind === "text") {
    const text = fs.readFileSync(t.assemble(0), "utf8");
    if (!text.trim()) throw Error("This file has no readable text.");
    await withSessionLock(id, (s) => {
      if (!pages.statusCounts(id).total) addTextPages(id, text);
      s.status = "processing";
    });
    kickoffSession(id);
  } else {
    const source = t.assemble(0),
      pdf =
        first.kind === "office"
          ? await convertOffice(source, t.folder)
          : source;
    validatePdfBuffer(fs.readFileSync(pdf));
    const stable = path.join(pageDir(id), "transfer-source.pdf");
    if (!fs.existsSync(stable)) fs.copyFileSync(pdf, stable);
    if (getSession(id)?.ingest?.status !== "done")
      await ingestTransferredPdf(id, stable);
  }
  t.update({ status: "accepted", error: null });
  t.clearParts();
}
async function drain() {
  while (working < 2 && pending.size) {
    const id = pending.values().next().value;
    pending.delete(id);
    running.add(id);
    working++;
    void ingest(id)
      .catch(async (e) => {
        console.error("[transfer] processing failed", id, e.message);
        if (getSession(id)) {
          store(id).update({
            status: "failed",
            error: "Could not prepare this document. Retry, or save it as PDF.",
          });
          await withSessionLock(id, (s) => {
            s.status = "failed";
            s.followUps = [
              ...(s.followUps || []).filter(
                (f) => f.type !== "transfer_failed",
              ),
              {
                id: "transfer-failed",
                type: "transfer_failed",
                status: "open",
                message:
                  "Could not prepare this document. Retry, or upload a PDF copy.",
              },
            ];
          });
        }
      })
      .finally(() => {
        running.delete(id);
        working--;
        void drain();
      });
  }
}
export function resumeTransfers() {
  for (const s of listSessions()) {
    const file = path.join(pageDir(s.id), "incoming", "manifest.json");
    if (!fs.existsSync(file)) continue;
    const t = store(s.id),
      state = t.read();
    if (["ready", "processing"].includes(state.status)) queue(s.id);
    // Incomplete uploads expire after seven days; completed source files follow session deletion.
    else if (
      state.status === "uploading" &&
      Date.now() - state.updatedAt > 7 * 86400000
    ) {
      fs.rmSync(t.folder, { recursive: true, force: true });
    }
  }
}
export default router;
