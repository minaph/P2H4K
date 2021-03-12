// import ILovePDFApi from "@ilovepdf/ilovepdf-nodejs";
// import dotenv from "dotenv";
import { Converter, CSSAdjustment, post, wslPath } from "./pdfUtils";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { StringDecoder } from "string_decoder";
import { PackageJson } from "type-fest";

const help = process.argv.includes("-h") || process.argv.includes("--help");
const email = process.argv.includes("--post");
const version =
  process.argv.includes("-v") || process.argv.includes("--version");

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")
) as PackageJson;

if (help) {
  let man: string;
  if (packageJson.man instanceof Array) {
    man = packageJson.man[0];
  } else {
    man = packageJson.man!;
  }
  console.log(fs.readFileSync(path.resolve(__dirname, "../", man), "utf8"));
} else if (version) {
  console.log(`P2H4K\nv${packageJson.version}`);
} else {
  // console.log(process.argv);
  let bin: string[];
  if (typeof packageJson.bin === "string") {
    bin = [packageJson.bin];
  } else {
    bin = Object.keys(packageJson.bin!);
  }
  bin = bin.map((x) => path.basename(x));
  const p2h4kIndex = process.argv.findIndex((x) =>
    bin.some((y) => x.includes(y))
  );
  const inputFile = process.argv.find(
    (x, i, arr) =>
      i > p2h4kIndex && !x.startsWith("-") && arr[i - 1] !== "--post"
  );

  const tounicode = process.argv.find(
    (v, i, arr) => i > 1 && arr[i - 1] === "--tounicode"
  ) || "-1";

  const inputFilePath = path.resolve(process.cwd(), inputFile!);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "P2H4K-"));
  let processingFile = inputFilePath;
  const outputDir = path.dirname(inputFilePath);
  let outputName = path.basename(processingFile, path.extname(processingFile));

  const decoder = new StringDecoder("utf8");

  console.log(
    `
#####   P2H4K - PDF to HTML converter for Kindle   #####

`,
    {
      inputFilePath,
      outputDir,
      tempDir,
    }
  );

  // dotenv.config({
  //   path: path.resolve(__dirname, "../.env"),
  // });

  // const ilovepdf = new ILovePDFApi(
  //   process.env.PUBLIC_KEY!,
  //   process.env.PRIVATE_KEY!
  // );

  // unlock(ilovepdf, inputFilePath, tempDir).then((unlockedFile) => {
  // processingFile = unlockedFile!;

  console.time("P2H4K");

  let c = new Converter("wsl pdf2htmlEX", tounicode);
  processingFile = c.convert(wslPath(processingFile), wslPath(tempDir));

  processingFile = CSSAdjustment(processingFile, tempDir);

  fs.unlinkSync(path.resolve(tempDir, "compatibility.min.js"));
  fs.unlinkSync(path.resolve(tempDir, "pdf2htmlEX.min.js"));

  const newName = path.basename(processingFile, ".html") + "2.html";
  fs.copyFileSync(processingFile, path.resolve(tempDir, newName));
  processingFile = path.resolve(tempDir, newName);

  const scriptPath = path.resolve(__dirname, "./playwright");
  let command = `node "${scriptPath}" "${processingFile}" "${tempDir}"`;
  console.log("> " + command);
  const out = execSync(command);
  console.log(decoder.write(out));
  processingFile = path.join(tempDir, path.basename(processingFile));

  outputName += path.extname(processingFile);
  fs.copyFileSync(processingFile, path.resolve(outputDir, outputName));
  processingFile = path.resolve(outputDir, outputName);

  if (email) {
    const url = process.argv.find(
      (_, i, arr) => i > 1 && arr[i - 1] === "--post"
    );
    if (!url) {
      console.error("Could not find url");
    } else {
      post(processingFile, url)
        .then((res) => {
          console.log(res.status, res.statusText);
        })
        .catch((err) => {
          console.error(err.message);
        });
    }
  }

  console.timeEnd("P2H4K");

  // });
}
