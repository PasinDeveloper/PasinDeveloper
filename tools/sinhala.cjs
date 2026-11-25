// Design-time: let Chromium shape Sinhala with Abhaya Libre, print to PDF (vector glyphs).
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const text = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage();
  const font = "file://" + path.resolve("fonts/AbhayaLibre-Regular.ttf");
  await p.setContent(`<style>@font-face{font-family:AL;src:url("${font}")}
    @page{margin:0}body{margin:0}span{font:100px/1.4 AL;white-space:nowrap}</style><span id=t>${text}</span>`);
  await p.evaluate(() => document.fonts.ready);
  const r = await p.evaluate(() => { const b = document.getElementById("t").getBoundingClientRect(); return [b.width, b.height]; });
  await p.pdf({ path: "tools/sinhala.pdf", width: Math.ceil(r[0]) + "px", height: Math.ceil(r[1]) + "px", printBackground: false });
  console.log(JSON.stringify(r));
  await b.close();
})();
