import { chromium } from "playwright";

const EXEC_PATH =
  "/Users/elysion/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell";

const browser = await chromium.launch({
  executablePath: EXEC_PATH,
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`CONSOLE_ERROR: ${msg.text()}`);
});

console.log("1. Navigating to Studio Home (/)...");
await page.goto("http://localhost:3456/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1", { timeout: 15000 });

const homeTitle = await page.locator("h1").first().innerText();
const homeAsideCount = await page.locator("aside").count();
const cardCount = await page.locator("main a[href*='/books/ddia-2e/ch/']").count();
console.log({ homeTitle, homeAsideCount, cardCount });

console.log("2. Navigating to Chapter 1 Reader (/books/ddia-2e/ch/1)...");
await page.goto("http://localhost:3456/books/ddia-2e/ch/1", {
  waitUntil: "domcontentloaded",
});
await page.waitForSelector(".bb-chapter-reader .chapter", { timeout: 15000 });
await page.waitForTimeout(500);

const readerStats = await page.evaluate(() => {
  const asides = document.querySelectorAll("aside").length;
  const chaptersInDom = document.querySelectorAll(".bb-chapter-reader .chapter").length;
  const topicsInDom = document.querySelectorAll(".bb-chapter-reader .topic").length;
  const svgsInDom = document.querySelectorAll(".bb-chapter-reader svg").length;
  const quizzesInDom = document.querySelectorAll(".bb-chapter-reader .quiz-q").length;
  return { asides, chaptersInDom, topicsInDom, svgsInDom, quizzesInDom };
});
console.log("Chapter 1 Reader DOM stats:", readerStats);

console.log("3. Navigating to Chapter 2 Reader (/books/ddia-2e/ch/2)...");
await page.goto("http://localhost:3456/books/ddia-2e/ch/2", {
  waitUntil: "domcontentloaded",
});
await page.waitForSelector(".bb-chapter-reader .chapter", { timeout: 15000 });
await page.waitForTimeout(400);

const ch2Stats = await page.evaluate(() => {
  const chaptersInDom = document.querySelectorAll(".bb-chapter-reader .chapter").length;
  const topicsInDom = document.querySelectorAll(".bb-chapter-reader .topic").length;
  const svgsInDom = document.querySelectorAll(".bb-chapter-reader svg").length;
  return { chaptersInDom, topicsInDom, svgsInDom };
});
console.log("Chapter 2 Reader DOM stats:", ch2Stats);

console.log("Errors:", errors);
await browser.close();

if (errors.length > 0 || readerStats.asides !== 1 || readerStats.chaptersInDom !== 1) {
  process.exit(1);
}
