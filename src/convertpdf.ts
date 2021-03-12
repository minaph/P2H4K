import { Converter } from "./pdfUtils";

console.log(
  new Converter("wsl pdf2htmlEX", "-1").convert(process.argv[2], process.cwd())
);
