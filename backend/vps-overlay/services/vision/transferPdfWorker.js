import { parentPort, workerData } from "node:worker_threads";
import { pdf } from "pdf-to-img";
import { savePageImage } from "./image.js";
try {
  const { id, file, skip } = workerData,
    existing = new Set(skip),
    doc = await pdf(file, { scale: 2.5 });
  if (!doc.length || doc.length > 1000)
    throw Error("Choose a PDF with between 1 and 1,000 pages.");
  parentPort.postMessage({ type: "total", total: doc.length });
  for (let number = 1; number <= doc.length; number++) {
    if (existing.has(number)) continue;
    const saved = await savePageImage(
      id,
      `transfer-pdf-${number}`,
      await doc.getPage(number),
    );
    parentPort.postMessage({
      type: "page",
      number,
      imagePath: saved.fullPath,
      width: saved.original?.width || null,
      height: saved.original?.height || null,
    });
  }
  parentPort.postMessage({ type: "done" });
} catch (error) {
  parentPort.postMessage({ type: "failure", message: error.message });
}
