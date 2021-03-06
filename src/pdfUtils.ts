import fs from "fs";
import path from "path";
import { execSync } from "child_process";

import * as rax from "retry-axios";
import axios from "axios";

export function wslPath(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/^([^\/]*):/, (_, drive: string) => "/mnt/" + drive.toLowerCase());
}

export class Converter {
  public options: string[];
  public appCommand: string;

  constructor(appCommand: string, tounicode: string) {
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
      "--tounicode " + tounicode, // for math, -1. for jp, 1
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
  //   return `${this.mean}px ?? ${this.std}std`;
  // }
}

function resize(text: string, fsTargetMean = 16, fsTargetStd = 8) {
  let patterns = [
    new sizeRule("font-size", "fs"),
    new sizeRule("vertical-align", "v"),
    new sizeRule("letter-spacing", "ls"),
    new sizeRule("bottom", "y"),
    new sizeRule("left", "x"),
    new sizeRule("word-spacing", "ws"),
  ];

  const hPattern = new sizeRule("height", "h");

  [...patterns, hPattern].forEach((pattern) => {
    pattern.setStats(text);
  });

  // lhPattern.setStats(text);
  // wsPattern.setStats(text);

  const fsPattern = patterns.find((pattern) => pattern.name === "font-size")!;

  const meanRatio = fsTargetMean / fsPattern.mean;
  const stdRatio = fsTargetStd / fsPattern.std;

  console.log(
    `${fsPattern.name}: ${fsPattern.mean} ?? ${fsPattern.std} -> ${fsTargetMean} ?? ${fsTargetStd}`,
    { meanRatio, stdRatio }
  );

  text = patterns.reduce((a, pattern) => {
    return pattern.getResized(
      a,
      pattern.mean * meanRatio,
      pattern.std * stdRatio
    );
  }, text);

  text = hPattern.getResized(text, 10 * fsTargetMean, 10 * fsTargetStd);

  return text;
}

export async function post(filePath: string, url: string) {
  // const url = process.env.SERVICE_ENDPOINT;
  try {
    const text = fs.readFileSync(filePath, "utf-8");
    // const contentBuffer = Buffer.from(text, "utf-8");
    // const base64 = contentBuffer.toString("base64");
    const interceptorId = rax.attach();
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
      raxConfig: {
        // Retry 3 times on requests that return a response (500, etc) before giving up.  Defaults to 3.
        retry: 3,

        // Retry twice on errors that don't return a response (ENOTFOUND, ETIMEDOUT, etc).
        noResponseRetries: 2,

        // HTTP methods to automatically retry.  Defaults to:
        // ['GET', 'HEAD', 'OPTIONS', 'DELETE', 'PUT']
        httpMethodsToRetry: ["POST"],

        // The response status codes to retry.  Supports a double
        // array with a list of ranges.  Defaults to:
        // [[100, 199], [429, 429], [500, 599]]
        statusCodesToRetry: [
          [100, 199],
          [429, 429],
          [500, 599],
        ],

        // You can set the backoff type.
        // options are 'exponential' (default), 'static' or 'linear'
        backoffType: "exponential",

        // You can detect when a retry is happening, and figure out how many
        // retry attempts have been made
        onRetryAttempt: (err) => {
          const cfg = rax.getConfig(err);
          console.log(`Retry attempt #${cfg!.currentRetryAttempt}`);
        },
      },
    });
    // console.log(await res.text())
    return res;
  } catch (e) {
    throw e;
  }
}
