import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? "/mnt/documents/boom-demo.mp4";
const range = process.argv[3];
const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});
const composition = await selectComposition({ serveUrl: bundled, id: "main", puppeteerInstance: browser });
await renderMedia({
  composition, serveUrl: bundled, codec: "h264", outputLocation: out,
  puppeteerInstance: browser, muted: true, concurrency: 1,
  frameRange: range ? range.split("-").map(Number) : undefined,
  onProgress: ({ progress }) => { if (Math.round(progress*100)%10===0) process.stdout.write(`\r${Math.round(progress*100)}%`); },
});
await browser.close({ silent: false });
console.log("\ndone", out);
