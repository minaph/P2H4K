import { Converter } from "./pdfUtils";

console.log(
  new Converter("wsl pdf2htmlEX").convert(process.argv[2], process.cwd())
);
