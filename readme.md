# P2H4K - PDF to HTML converter for Kindle

CLI tool to convert scientific papers into Kindle readable HTML docs.

This project is pure beta.

# Features

- Adjusted pdf2htmlEX options and HTML/CSS optimizations for Converting Scientific Papers.
- Some Math characters in HTML are captured as images to avoid characters being garbled.
- Send the converted file to an endpoint at the end of the process (OPTIONAL).

This project focuses on the use of the Kindle Personal Document service. If you are interested in use for Kindle Direct Publishing, contact me.

Feature requests are also welcome. 

# Usage

```shell
p2h4k /path/to/your/pdf [--post <url>][-v, --version][-h, --help]
```

For More details about options, see  `--help`

# Install

This project depends on pdf2htmlEX and many npm projects.

Please setup node.js and pdf2htmlEX by yourself.

## Windows

If your computer is based on Windows and pdf2htmlEX is installed on Windows subsystem for Linux 2, no modification is needed.

Run

```shell
npm install -g p2h4k
```

or

```shell
yarn global install p2h4k
```

## Others

**Notice** This project is only tested on Windows.

If your PC has another setup, clone this project, then rewrite Converter Class init (in `src/main.ts`) with your pdf2htmlEX command.

```javascript
// let c = new Converter("wsl pdf2htmlEX");
// processingFile = c.convert(wslPath(processingFile), wslPath(tempDir));

let c = new Converter("/path/to/your/pdf2htmlEX");
processingFile = c.convert(processingFile, tempDir);
```

then build with `npm|yarn run build`, then follow the instructions for Windows.

# Known Difficulty

Text markup on Kindle does not work properly.

1. Some texts cannot be selected.
2. Texts sometimes wrap other texts (while all texts can be read).

Causes and solutions are still unknown.

# Develop

```
P2H4K/src
│  convertpdf.ts        small debug script
│  main.ts              entry point
│  pdfUtils.ts          functions and classes to process HTML as strings or to call external APIs/tools.
│  playwright.js        provide web APIs to edit HTML
│  webScript.ts         scripts run in web (to be called by playwright.js)
│  webUtils.ts          classes for webScript.ts
```

Any help (or bug report) would be appreciated!

# Todo

1. Read all options from a single JSON file (converter path, endpoint, pdf2htmlex options,...)
2. Config file generator
3. Snapshot flag

# License

MIT license.

Licenses of Dependencies can be found in `LICENSE.txt`.

# Contact

Author: Yuki Minoh

Email: yukikaze.0511 at gmail.com
