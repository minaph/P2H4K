import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// import UnlockTask from "@ilovepdf/ilovepdf-js-core/tasks/UnlockTask";
// import ILovePDFApi from "@ilovepdf/ilovepdf-nodejs";
// import ILovePDFFile from "@ilovepdf/ilovepdf-js-core/utils/ILovePDFFile";

import axios from "axios";
// import dotenv from "dotenv";

// dotenv.config({
//   path: path.resolve(__dirname, "../.env"),
// });

export function wslPath(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/^([^\/]*):/, (_, drive: string) => "/mnt/" + drive.toLowerCase());
}

// export async function unlock(
//   ilovepdf: ILovePDFApi,
//   filepath: string,
//   destDir: string
// ) {
//   // const errorHandler = (e: Error) => console.error(e);
//   console.log("Requesting iLovePDF Web API...");
//   let task = ilovepdf.newTask("unlock") as UnlockTask;
//   let index = 0;
//   try {
//     task = await task.start();
//     index++;
//     const file = new ILovePDFFile(filepath);
//     task = await task.addFile(file);
//     index++;
//     task = await task.process();
//     index++;
//     const data = await task.download();

//     const basename = path.basename(file.filename, ".pdf") + "_unlocked.pdf";
//     const newFilePath = path.join(destDir, basename);
//     fs.writeFileSync(newFilePath, data);
//     console.log("Done");
//     return newFilePath;
//   } catch (error) {
//     console.error(error.message, "\nError index: " + index);
//     throw error;
//   }
// }

export class Converter {
  public options: string[];
  public appCommand: string;

  constructor(appCommand: string) {
    this.appCommand = appCommand;

    this.options = [
      "--zoom 25",
      "--dpi 400",
      "--covered-text-dpi 300",
      "--embed CfIjO",
      "--dest-dir ",
      // "--process-annotation 1",
      "--fallback 1",
      // "--process-type3 1",
      // "--font-format ttf",
      // "--decompose-ligature 1",
      // "--auto-hint 1",
      "--font-size-multiplier 1",
      "--space-as-offset 0",
      "--tounicode 0", // for math, -1. for jp, 1
      "--optimize-text 1",
      // "--correct-text-visibility 1",
      // "--bg-format jpg",
      "--no-drm 1",
      // "--debug 1",
      "--proof 1",
    ];
  }

  convert(filepath: string, destDir: string) {
    this.options = this.options.map((x) => {
      if (x.startsWith("--dest-dir") && x.endsWith(" ")) {
        return `${x} "${destDir}"`;
      } else {
        return x;
      }
    });

    try {
      const command = `${this.appCommand} ${this.options.join(
        " "
      )} "${filepath}"`;
      console.log("> " + command);
      const out = execSync(command);
      console.log(out);
    } catch (err) {
      throw err;
    }
    const newFileName = path.basename(filepath, ".pdf") + ".html";
    let newFilePath = path.join(destDir, newFileName);
    if (newFilePath.startsWith("\\mnt")) {
      // This case only happens when the command uses WSL
      // but caller is on windows
      newFilePath = newFilePath.replace(
        /^\\mnt\\([^\\]*)/,
        (_, drive: string) => drive.toUpperCase() + ":"
      );
    }
    return newFilePath;
  }
}

export function CSSAdjustment(filePath: string, destDir: string) {
  console.log("Adjusting CSS...");
  let text = fs.readFileSync(filePath, "utf-8");
  text = text
    .replace(
      "<head>",
      '<head><meta http-equiv="content-type" content="text/html; charset=utf-8" />'
    )
    .replace(/\.pf\{[^\}]*\}/g, ".pf{position:relative;}")
    .replace(/\.w0\{[^\}]*\}/g, "")
    .replace(/\.m0.*\}/, "")
    .replace(".fc0{color:transparent;}", "");

  text = resize(text, 11, 7);

  const newFilePath = path.join(destDir, path.basename(filePath));
  fs.writeFileSync(newFilePath, text);
  console.log("Done");
  return newFilePath;
}

class sizeRule {
  public name: string;
  private pxPattern: RegExp;
  private ptPattern: RegExp;
  public mean = 0;
  public std = 1;
  private pairs = new Map();
  constructor(name: string, acronym: string) {
    this.name = name;
    this.pxPattern = new RegExp(
      `(\.${acronym}[0-9a-z]{1,3})\{${name}:(-?[0-9.]*)px;\}`,
      "g"
    );
    this.ptPattern = new RegExp(
      `(\.${acronym}[0-9a-z]{1,3})\{${name}:(-?[0-9.]*)pt;\}`,
      "g"
    );
  }

  setPatterns(newPx: RegExp, newPt: RegExp) {
    this.pxPattern = newPx;
    this.ptPattern = newPt;
  }

  setStats(text: string) {
    let arr = [];
    for (const m of text.matchAll(this.pxPattern)) {
      this.pairs.set(m[1], parseFloat(m[2]) - 0);
      arr.push(parseFloat(m[2]) - 0);
    }

    this.mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    let suqaredMean = arr.reduce((a, b) => a + b ** 2, 0) / arr.length;
    let variance =
      (suqaredMean - this.mean ** 2) * (arr.length / (arr.length - 1));
    this.std = Math.sqrt(variance);
  }

  getResized(text: string, targetMean: number, targetStd: number) {
    text = text.replace(this.ptPattern, "");

    text = text.replace(this.pxPattern, (match, p1, p2) =>
      match.replace(
        p2,
        (
          ((this.pairs.get(p1) - this.mean) * targetStd) / this.std +
          targetMean
        ).toString()
      )
    );

    return text;
  }

  // getStatsText(): string {
  //   return `${this.mean}px ± ${this.std}std`;
  // }
}

function resize(text: string, fsTargetMean = 16, fsTargetStd = 8) {
  let patterns = [
    new sizeRule("font-size", "fs"),
    new sizeRule("vertical-align", "v"),
    new sizeRule("letter-spacing", "ls"),
    // new sizeRule("height", "h"),
    new sizeRule("bottom", "y"),
    new sizeRule("left", "x"),
    new sizeRule("word-spacing", "ws")
  ];

  // const wsPattern = new sizeRule("word-spacing", "ws");

  // const lhPattern = new sizeRule("line-height", "ff");
  // lhPattern.setPatterns(
  //   /(\.ff[0-9a-z]{1,3})\{[^\{]*line-height:(-?[0-9\.]*);[^\}]*\}/,
  //   /a^/
  // );

  patterns.forEach((pattern) => {
    pattern.setStats(text);
  });

  // lhPattern.setStats(text);
  // wsPattern.setStats(text);

  const fsPattern = patterns.find((pattern) => pattern.name === "font-size")!;

  const meanRatio = fsTargetMean / fsPattern.mean;
  const stdRatio = fsTargetStd / fsPattern.std;

  // const hPattern = patterns.filter((pattern) => pattern.name === "height")[0];
  // hPattern.mean *= 0.5;

  console.log(
    `${fsPattern.name}: ${fsPattern.mean} ± ${fsPattern.std} -> ${fsTargetMean} ± ${fsTargetStd}`,
    { meanRatio, stdRatio }
  );

  text = patterns.reduce((a, pattern) => {
    return pattern.getResized(
      a,
      pattern.mean * meanRatio,
      pattern.std * stdRatio
    );
  }, text);

  // text = lhPattern.getResized(text, 2, lhPattern.std * stdRatio);
  // text = wsPattern.getResized(text, 5, 1);

  return text;
}

export async function post(filePath: string, url: string) {
  // const url = process.env.SERVICE_ENDPOINT;
  try {
    const text = fs.readFileSync(filePath, "utf-8");
    // const contentBuffer = Buffer.from(text, "utf-8");
    // const base64 = contentBuffer.toString("base64");

    var res = await axios(url!, {
      method: "post",
      headers: {
        "Sec-Fetch-Mode": "no-cors",
      },
      data: {
        html: text,
        name: path.basename(filePath, ".html"),
      },
      maxBodyLength: 1024 * 1024 * 25,
      maxContentLength: 1024 * 1024 * 25,
    });
    // console.log(await res.text())
    return res;
  } catch (e) {
    throw e;
  }
}

