import {StyleMap, PrivateChar} from "./webUtils"


function removeSmallSpan() {
  // Remove span elments without text or only with a space
  let spanList = [...document.querySelectorAll("span")];
  spanList
    .filter((x: HTMLSpanElement) => x.textContent!.length === 0)
    .forEach((x) => x.remove());

  spanList
    .filter((x) => x.textContent === " ")
    .forEach((x) => {
      x.parentElement!.insertBefore(new Text(" "), x);
      x.remove();
    });

  document.body.normalize();
}

function divDiscomposition() {
  // div discomposition
  let tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (el) => {
      if (el.parentElement!.classList.contains("t")) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_REJECT;
    },
  });
  let referenceNode: Text;
  const span = document.createElement("span");
  const pairs: [HTMLElement, Text][] = [];
  while ((referenceNode = tw.nextNode() as Text)) {
    const newSpan = span.cloneNode(false) as typeof span;
    pairs.push([newSpan, referenceNode]);
  }
  pairs.forEach((pair) => {
    pair[1].parentNode!.insertBefore(pair[0], pair[1]);
    pair[0].appendChild(pair[1]);
  });
}

function spanHeightCorr() {
  // height correction
  const spans = [
    ...(document.querySelectorAll(".pc span") as NodeListOf<HTMLSpanElement>),
  ];
  let heightData: number[] = Array(spans.length);

  const rects = spans
    .map((x) => x.getBoundingClientRect())
    .map((x) => x.height);

  const styles = [...Array(spans.length)].map((_) => new StyleMap());

  for (var [i, x] of spans.entries()) {
    const trueHeight = Math.max(x.scrollHeight, rects[i]);
    heightData[i] = trueHeight;

    // const bottom = parseFloat(getComputedStyle(x).bottom.slice(0, -2));
    // const nextBottom = bottom - (trueHeight - height);

    const styleMap = styles[i];
    styleMap.setImportance(3);

    styleMap.set("height", trueHeight + "px");
    // styleMap.set("bottom", nextBottom + "px");
    // x.style = `height: ${nextHeight}px; bottom: ${nextBottom}px;border: solid 1px green`;
  }

  styles.map((x) => x.tempRule()).map((x, i) => spans[i].classList.add(...x));

  return heightData;
}

function divHeightCorr() {
  // div height recorrection
  const divs = [
    ...(document.querySelectorAll(".pc div.t") as NodeListOf<HTMLDivElement>),
  ];

  const rects = divs.map((x) => x.getBoundingClientRect()).map((x) => x.height);

  const styles = [...Array(divs.length)].map((_) => new StyleMap());

  for (var [i, x] of divs.entries()) {
    const trueHeight = Math.max(x.scrollHeight, rects[i]);

    // const bottom = parseFloat(getComputedStyle(x).bottom.slice(0, -2));
    // const nextBottom = bottom - (trueHeight - height);

    const styleMap = styles[i];
    styleMap.setImportance(3);

    styleMap.set("height", trueHeight + "px");
    // styleMap.set("bottom", nextBottom + "px");
    // x.style = `height: ${nextHeight}px; bottom: ${nextBottom}px;border: solid 1px green`;
  }

  styles.map((x) => x.tempRule()).map((x, i) => divs[i].classList.add(...x));
}

function getBaseStats(data: number[]) {
  const mean = data.reduce((acc, val) => acc + val, 0) / data.length;
  const squaredMean =
    data.reduce((acc, val) => acc + val ** 2, 0) / data.length;
  const variance =
    (squaredMean - mean ** 2) * (data.length / (data.length - 1));
  const std = variance ** 0.5;

  return { mean, std };
}

function mergeSuffixes(mean: number, std: number) {
  // suffix div merge into previousSibling
  const space = document.createTextNode(" ");
  const span = document.createElement("span");
  // let newClassNames: string[] = [];
  span.append(space.cloneNode(true));
  [
    ...(document.querySelectorAll("div.t") as NodeListOf<HTMLDivElement>),
  ].forEach((div) => {
    if (div.previousSibling === null) {
      return;
    }
    let firstChildIterator = document.createNodeIterator(
      div,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (el: HTMLElement) =>
          el.parentNode!.firstChild!.contains(el) &&
          div.firstChild!.contains(el) &&
          el.textContent!.length! < 25 &&
          el.childNodes[0].nodeName === "#text" &&
          el.getBoundingClientRect().height < mean - std * 0.5
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP,
      }
    );
    let firstChild;
    while ((firstChild = firstChildIterator.nextNode() as HTMLSpanElement)) {
      const targetElement = firstChild;

      const newSpan = span.cloneNode(true) as HTMLSpanElement;
      newSpan.classList.add(...div.classList, ...targetElement.classList);
      newSpan.append(...targetElement.childNodes);
      div.previousElementSibling!.appendChild(newSpan);
      targetElement.remove();

      const spanStyle = new StyleMap();
      spanStyle.setImportance(3);

      spanStyle.set("left", "0px");
      spanStyle.set("bottom", "0px");

      // newClassNames =
      newSpan.classList.add(...spanStyle.staticRule());
    }

    if (!div.hasChildNodes()) {
      div.remove();
    }
  });
}

async function snapshotPrivateChars() {
  const privateCharsExp = /\p{Private_Use}/gu;
  let targetNodesIterator = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (el: Text) =>
        privateCharsExp.test(el.wholeText)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    }
  );
  let targetNode = targetNodesIterator.nextNode() as Text;
  let charIndex = targetNode.data.search(privateCharsExp);
  let planned = new Map<string, HTMLSpanElement[]>();
  const span = document.createElement("span");
  let newSpan = span.cloneNode(false) as typeof span;
  // buggy point
  // charIndex shoud be 0, length of data should be 1
  // and parentNode should has only targetNode as child,
  while (targetNode) {
    charIndex = targetNode.data.search(privateCharsExp);
    if (charIndex > 0) {
      targetNode = targetNode.splitText(charIndex);
      charIndex = 0;
    }

    if (targetNode.length > 1) {
      targetNode.splitText(1);
    }
    // console.log("Prepared targetNode", { targetNode });

    let parentElement = targetNode.parentElement!;

    if (parentElement.childNodes.length > 1) {
      parentElement.insertBefore(newSpan, targetNode);
      newSpan.appendChild(targetNode);
      newSpan = span.cloneNode(false) as typeof span;

      parentElement = newSpan;
    }

    const index = targetNode.data + getComputedStyle(parentElement).fontSize;
    if (planned.has(index)) {
      planned.get(index)!.push(parentElement);
    } else {
      planned.set(index, [parentElement]);
    }

    targetNode = targetNodesIterator.nextNode() as Text;
  }
  // await install;

  // This is a very huge process
  // Need to separate into small processes
  // const dataUrls = await Promise.all(
  //   [...planned.values()].map((elements) => {
  //     return getSnapshot(elements[0]);
  //   })
  // );

  const chars = [...planned.values()].map(
    (elements) => new PrivateChar(elements[0])
  );

  chars.forEach((c) => c.prepare());

  chars.forEach((c) => c.setMetrics());

  // await Promise.all(chars.map((c) => c.setSnapshot()));
  await chars.reduce((acc, c) => acc.then(async () => await c.setSnapshot()), Promise.resolve());

  [...planned.values()].forEach((elements, i) => {
    // const fontDiff = getFontDiff(elements[0]);
    const newClassName = chars[i].getBgImageRule();
    // const newClassName = setBgImageRule(dataUrls[i], fontDiff);
    elements.forEach((x) => x.classList.add(...newClassName));
  });

  return;
}

function singlePage() {
  // Compile All Pages into a single page
  let pcs = document.querySelectorAll(".pc");
  let homepage = pcs[0];
  let children = Array.prototype.slice.call(pcs, 1);
  children = children.flatMap((c) => Array.from(c.children));
  // children.forEach((c) => homepage.appendChild(c));
  homepage.append(...children);
}

(async function main() {
  // Web Client Process

  // const cssClassMap = new Map<string, string[]>();

  console.time("P2H4K");
  let index = 0;

  removeSmallSpan();

  console.timeLog("P2H4K", { index: index++ });

  divDiscomposition();

  console.timeLog("P2H4K", { index: index++ });

  const spanHeightData = spanHeightCorr();
  // cssClassMap.set("span", spanClassList);

  console.timeLog("P2H4K", { index: index++ });

  divHeightCorr();
  // cssClassMap.set("div", divClassList);

  console.timeLog("P2H4K", { index: index++ });

  const { mean: spanHeightMean, std: spanHeightStd } = getBaseStats(
    spanHeightData
  );

  console.timeLog("P2H4K", { index: index++ });

  mergeSuffixes(spanHeightMean, spanHeightStd);
  // cssClassMap.set("span", newSpanClassList);

  console.timeLog("P2H4K", { index: index++ });

  await snapshotPrivateChars();

  console.timeLog("P2H4K", { index: index++ });

  singlePage();

  // div height recorrection
  // divHeightCorr()

  console.log("All done!");
  console.timeEnd("P2H4K");

  // return document.documentElement.outerHTML;
})();
