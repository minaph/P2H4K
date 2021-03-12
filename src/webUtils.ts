import html2canvas from "html2canvas";

export class StyleMap extends Map<string, string> {
  private classNames: string[];
  private className: string;
  private outputNames: string[];
  private importance = 1;
  private sheet;
  constructor(iterable?: any) {
    super(iterable);
    this.classNames = ["c-" + Math.random().toString(32).substring(2)];
    this.className = this.classNames[0];
    this.outputNames = this.classNames;

    const sheet = [...document.styleSheets].find((x) => !x.disabled);
    if (!sheet) {
      throw new Error("No Stylesheets available");
    }
    this.sheet = sheet;
  }

  public toString(): string {
    return `.${this.className} {
      ${[...this].map((x) => x[0] + ": " + x[1]).join(";\n")};
    }`;
  }

  public staticRule() {
    const styleElement = document.createElement("style");
    const ruleStrings = this.toString();
    const textNode = new Text(ruleStrings);
    styleElement.appendChild(textNode);
    document.head.append(styleElement);

    return this.outputNames;
  }

  public tempRule() {
    this.sheet.insertRule(this.toString());

    return this.outputNames;
  }

  public setImportance(importance: number) {
    this.importance = importance;
    if (this.importance > this.classNames.length) {
      const randomNames = [
        ...Array(this.importance - this.classNames.length),
      ].map((_) => "c-" + Math.random().toString(32).slice(2));
      this.classNames.push(...randomNames);

      this.className = this.classNames.slice(0, this.importance).join(".");
      this.outputNames = this.classNames.slice(0, this.importance);
    }

    return this;
  }
}

type metrics = {
  verticalAlign: number;
  baseline: number;
  under: number;
};

class FontMeasure {
  subject: HTMLElement;
  object: HTMLElement;
  private container: HTMLElement;

  conditionRules: { [P in "subject" | "object" | "container"]: string[] };

  constructor(element: HTMLElement, object?: HTMLElement) {
    this.subject = element.cloneNode(true) as typeof element;

    this.object = object
      ? object
      : (this.subject.cloneNode(true) as typeof element);

    this.container = document.createElement("div");
    this.conditionRules = { subject: [], object: [], container: [] };
  }

  setCondition(
    subjectRule: StyleMap,
    objectRule: StyleMap,
    containerRule?: StyleMap
  ) {
    [subjectRule, objectRule, containerRule].map((x) => x?.setImportance(5));
    this.conditionRules.subject = subjectRule.tempRule();
    this.conditionRules.object = objectRule.tempRule();
    this.conditionRules.container = containerRule?.tempRule() || [];

    this.subject.classList.add(...this.conditionRules.subject);
    this.object.classList.add(...this.conditionRules.object);
    if (containerRule) {
      this.container.classList.add(...this.conditionRules.container);
    }
  }

  measure(
    func: (
      subject: HTMLElement,
      object: HTMLElement,
      container: HTMLElement
    ) => any
  ) {
    this.container.append(this.subject, this.object);
    document.body.appendChild(this.container);

    const result = func(this.subject, this.object, this.container);

    this.container.remove();

    return result;
  }
}

export class PrivateChar {
  element: HTMLElement;
  fontFamily: string;
  fontSize: string;
  metrics?: metrics;
  preparationStyleRule?: string[];

  diffMap?: Map<string, number | DOMRect[keyof DOMRect]>;

  private dataUrl?: string;

  constructor(element: HTMLElement) {
    this.element = element;
    const computedStyle = getComputedStyle(element);
    this.fontFamily = computedStyle.fontFamily;
    this.fontSize = computedStyle.fontSize;
  }

  public prepare() {
    const rules = new StyleMap();
    rules.set("vertical-align", "baseline !important");
    this.preparationStyleRule = rules.tempRule();
  }

  public setMetrics() {
    const basic = new FontMeasure(
      document.createElement("span"),
      document.createElement("img")
    );

    const SMALL_IMAGE =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const SAMPLE_TEXT = "Hidden Text";

    const containerStyle = new StyleMap();

    containerStyle.set("visibility", "hidden");
    containerStyle.set("font-family", this.fontFamily);
    containerStyle.set("font-size", this.fontSize);
    containerStyle.set("margin", "0");
    containerStyle.set("padding", "0");

    const imgStyle = new StyleMap();

    imgStyle.set("margin", "0");
    imgStyle.set("padding", "0");
    imgStyle.set("vertical-align", "baseline");

    const spanStyle = new StyleMap();

    spanStyle.set("font-family", this.fontFamily);
    spanStyle.set("font-size", this.fontSize);
    spanStyle.set("margin", "0");
    spanStyle.set("padding", "0");

    basic.setCondition(spanStyle, imgStyle, containerStyle);

    this.metrics = basic.measure((span, image, _) => {
      const img = image as HTMLImageElement;

      img.src = SMALL_IMAGE;
      img.width = 1;
      img.height = 1;

      span.appendChild(document.createTextNode(SAMPLE_TEXT));
      const baseline = img.offsetTop - span.offsetTop + 2;
      const under = span.offsetHeight - baseline;

      return { baseline, under };
    });

    const measureVA = new FontMeasure(this.element);

    const rules = new StyleMap();
    rules.set("vertical-align", "baseline !important");

    measureVA.setCondition(new StyleMap(), rules, containerStyle);

    this.metrics!.verticalAlign = measureVA.measure(
      (element, elementWithoutVA) =>
        elementWithoutVA.offsetTop - element.offsetTop
    );

    const measureDiff = new FontMeasure(this.element);

    const elementStyle = new StyleMap(containerStyle);
    const objectStyle = new StyleMap(containerStyle);

    elementStyle.set("font-family", "initial");

    measureDiff.setCondition(elementStyle, objectStyle, containerStyle);

    this.diffMap = measureDiff.measure((element, object, _) => {
      const diffMap = new Map<string, number | DOMRect[keyof DOMRect]>();

      if (element.nextElementSibling !== object) {
        [element, object] = [object, element];
      }

      const rect = element.getBoundingClientRect();
      "x y width height top right bottom left"
        .split(" ")
        .forEach((key: string) => {
          diffMap.set(key, rect[key as keyof DOMRect]);
        });

      element.remove();

      const rectWithoutFont = object.getBoundingClientRect();

      "x y width height top right bottom left"
        .split(" ")
        .forEach((key: string) => {
          diffMap.set(
            key,
            (diffMap.get(key)! as number) -
              (rectWithoutFont[key as keyof DOMRect] as number)
          );
        });
      return diffMap;
    });
  }

  public async setSnapshot() {
    this.element.classList.add(...this.preparationStyleRule!);
    const rect = this.element.getBoundingClientRect();

    try {
      var snapshot = await html2canvas(this.element, {
        scale: 1,
        width: rect.width,
        height: rect.height,
        y:
          window.scrollY +
          rect.top +
          Math.max(this.metrics!.under - this.metrics!.baseline, 0),
      });
    } catch (e) {
      console.error(e, this);
    }
    this.element.classList.remove(...this.preparationStyleRule!);

    // debug
    // snapshot.style.border = "1px solid black";
    // document.body.appendChild(snapshot);
    // end debug

    this.dataUrl = snapshot!.toDataURL("image/png");
  }

  public getBgImageRule() {
    // const newClassName = "c" + Math.random().toString(32).substring(2);

    const margin = "top right bottom left"
      .split(" ")
      // .map((x) => -diffMap.get(x))
      .map((x) => Math.min(this.diffMap!.get(x)! as number, 0));

    const padding = margin.map((x) => -x);
    const bgMap = new StyleMap();

    bgMap.set(`background-image`, `url('${this.dataUrl}')`);
    bgMap.set(`background-repeat`, `no-repeat`);
    bgMap.set(`background-size`, `contain`);
    bgMap.set(`margin`, `${margin.join("px ")}px`);
    bgMap.set(`padding`, `${padding.join("px ")}px`);

    return bgMap.staticRule();
  }
}
