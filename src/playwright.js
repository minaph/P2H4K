const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
// const main = require("./webScript");
// const main = require(path.resolve(__dirname, "webScript")).default;

const main = fs.readFileSync(path.join(__dirname, "webScript.js"), "utf8");

const filePath = path.resolve(process.cwd(), process.argv[2]);
const destDir = process.argv[3];

console.log("Running Playwright...");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`file:///${filePath.replace(/\\/g, "/")}`);
  await page.evaluate(`${main}`);
  const text = `<html>${await page.innerHTML("html")}</html>`

  console.log("HTML Length: " + text.length);
  await browser.close();

  const newFilePath = path.join(destDir, path.basename(filePath));
  console.log(newFilePath);

  fs.writeFile(newFilePath, text, (err) => {
    if (err) throw err;
    console.log("Done");
  });
})();
