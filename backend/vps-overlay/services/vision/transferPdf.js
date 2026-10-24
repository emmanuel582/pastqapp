import { Worker } from "node:worker_threads";
import * as pages from "./pageStore.js";
import { withSessionLock, kickoffSession } from "./processor.js";
/** Stable page IDs allow a VPS restart to resume PDF rasterisation without duplicating or overwriting finished pages. */
export async function ingestTransferredPdf(id, file) {
  const existing = pages
    .listPages(id)
    .filter((p) => p.id.startsWith(id + "-pdf-"))
    .map((p) => Number(p.id.slice((id + "-pdf-").length)));
  await withSessionLock(id, (s) => {
    s.status = "processing";
    s.ingest = {
      status: "running",
      pagesDone: existing.length,
      startedAt: Date.now(),
      file: "transfer-source.pdf",
    };
  });
  try {
    await new Promise((resolve, reject) => {
      let chain = Promise.resolve(),
        finished = false;
      const worker = new Worker(
        new URL("./transferPdfWorker.js", import.meta.url),
        {
          workerData: { id, file, skip: existing },
          execArgv: process.execArgv.filter(
            (a) => !a.startsWith("--input-type"),
          ),
        },
      );
      const fail = (error) => {
        if (finished) return;
        finished = true;
        void worker.terminate();
        reject(error);
      };
      worker.on("message", (message) => {
        if (message.type === "failure") return fail(Error(message.message));
        if (message.type === "total")
          chain = chain.then(() =>
            withSessionLock(id, (s) => {
              s.ingest.totalPages = message.total;
            }),
          );
        if (message.type === "page")
          chain = chain.then(async () => {
            const pageId = id + "-pdf-" + message.number;
            await withSessionLock(id, (s) => {
              if (!pages.getPage(pageId))
                pages.addPages(id, [
                  {
                    id: pageId,
                    index: message.number - 1,
                    status: "pending",
                    filename: "pdf-page-" + message.number,
                    imagePath: message.imagePath,
                    width: message.width,
                    height: message.height,
                    source: "pdf",
                  },
                ]);
              s.ingest.pagesDone = pages.statusCounts(id).total;
            });
            if (message.number % 10 === 0) kickoffSession(id);
          });
        if (message.type === "done")
          chain.then(() => {
            if (!finished) {
              finished = true;
              resolve();
            }
          }, fail);
        void chain.catch(fail);
      });
      worker.on("error", fail);
      worker.on("exit", (code) => {
        if (code !== 0)
          fail(Error("PDF preparation stopped. Retry to resume."));
      });
    });
    await withSessionLock(id, (s) => {
      s.ingest = { ...s.ingest, status: "done", finishedAt: Date.now() };
    });
  } catch (error) {
    await withSessionLock(id, (s) => {
      s.ingest = { ...s.ingest, status: "failed", error: error.message };
    });
    throw error;
  } finally {
    kickoffSession(id);
  }
}
