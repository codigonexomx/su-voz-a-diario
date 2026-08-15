const { YouVersionBibleClient } = require("./youVersionBibleClient");
const client = new YouVersionBibleClient({
  appKey: "TvDAMKYrDRhVQReRPhiGb3lNWoLniPM5guyF7sRsizXDZoE3",
  baseUrl: "https://api.youversion.com/v1"
});
async function main() {
  const chapter = await client.request(`/bible/chapter/89/PSA.135?include_headings=true&include_notes=true`);
  console.log("HTML DUMP:");
  console.log(chapter.content.substring(0, 1500));
}
main().catch(console.error);
