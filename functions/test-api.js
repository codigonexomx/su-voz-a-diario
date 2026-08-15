const { YouVersionBibleClient } = require("./youVersionBibleClient");
const client = new YouVersionBibleClient({
  appKey: "TvDAMKYrDRhVQReRPhiGb3lNWoLniPM5guyF7sRsizXDZoE3",
  baseUrl: "https://api.youversion.com/v1"
});
async function main() {
  const chapter = await client.getChapterVerses({ versionId: "89", bookUsfm: "LEV", chapter: 3 });
  console.log("FOOTNOTES:");
  chapter.verses.filter(v => v.footnotes?.length || v.crossReferences?.length).forEach(v => {
    console.log(`Verse ${v.number}:`);
    console.log("  Footnotes:", v.footnotes);
    console.log("  CrossRef:", v.crossReferences);
  });
}
main().catch(console.error);
