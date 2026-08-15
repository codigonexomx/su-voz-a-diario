const cheerio = require("cheerio");

function getHtmlAttribute(attributes, name) {
  const match = String(attributes || "").match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i")
  );
  return match?.[2] ?? null;
}

function hasHtmlClass(attributes, className) {
  const classes = getHtmlAttribute(attributes, "class");
  return classes ? classes.split(/\s+/).includes(className) : false;
}

function removeVisualVerseLabels(html) {
  return String(html || "").replace(
    /<span\b([^>]*)>[\s\S]*?<\/span>/gi,
    (match, attributes) => (hasHtmlClass(attributes, "yv-vlbl") ? "" : match)
  );
}

function decodeHtmlEntities(value) {
  const entities = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: "\"" };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      const normalized = entity.toLowerCase();
      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return Number.isInteger(codePoint) && codePoint <= 0x10FFFF ? String.fromCodePoint(codePoint) : match;
      }
      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return Number.isInteger(codePoint) && codePoint <= 0x10FFFF ? String.fromCodePoint(codePoint) : match;
      }
      return entities[normalized] ?? match;
  });
}

function htmlToPlainText(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  ).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

function extractPassageVerses(content) {
  const html = String(content || "");
  const markerPattern = /<span\b([^>]*)>\s*<\/span>/gi;
  const markers = [];

  for (const match of html.matchAll(markerPattern)) {
    const attributes = match[1];
    const number = Number(getHtmlAttribute(attributes, "v"));
    if (hasHtmlClass(attributes, "yv-v") && Number.isInteger(number) && number > 0) {
      markers.push({ number, start: match.index, end: match.index + match[0].length });
    }
  }

  const verses = [];

  for (const [index, marker] of markers.entries()) {
    const nextMarker = markers[index + 1];
    
    let precedingHtml = "";
    if (index === 0) {
      precedingHtml = html.slice(0, marker.start);
    }
    
    const verseHtml = html.slice(marker.end, nextMarker?.start ?? html.length);
    
    const $pre = cheerio.load(precedingHtml, null, false);
    const $verse = cheerio.load(verseHtml, null, false);
    
    const subtitles = [];
    $pre('.s, .s1, .s2, .s3, .heading').each((i, el) => subtitles.push($pre(el).text().trim()));
    $verse('.s, .s1, .s2, .s3, .heading').each((i, el) => {
       subtitles.push($verse(el).text().trim());
       $verse(el).remove();
    });
    
    const footnotes = [];
    $verse('.f, .note, .footnote').each((i, el) => {
       footnotes.push($verse(el).text().trim());
       $verse(el).remove();
    });
    
    const crossReferences = [];
    $verse('.r, .x, .crossreference').each((i, el) => {
       crossReferences.push($verse(el).text().trim());
       $verse(el).remove();
    });
    
    const cleanVerseHtml = $verse.html();
    const text = htmlToPlainText(removeVisualVerseLabels(cleanVerseHtml));

    if (text) {
      verses.push({
        number: marker.number,
        text,
        reference: "",
        subtitle: subtitles.filter(Boolean).join(" - "),
        footnotes: footnotes.filter(Boolean),
        crossReferences: crossReferences.filter(Boolean)
      });
    }
  }

  return verses;
}

const sampleHtml = `
<div class="s1">La Creación del Mundo</div>
<span class="yv-v" v="1"></span><span class="yv-vlbl">1 </span>En el principio creó Dios... <span class="f">a. O, En el principio...</span>
<span class="yv-v" v="2"></span><span class="yv-vlbl">2 </span>Y la tierra estaba desordenada...
`;
console.log(JSON.stringify(extractPassageVerses(sampleHtml), null, 2));
