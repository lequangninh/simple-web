// build-from-airtable.mjs
// Generate index.html from Airtable content

import fs from "node:fs/promises";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Table names in Airtable
const GLOBALS_TABLE = "Globals";
const SECTIONS_TABLE = "Sections";

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error(
    "❌ Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID environment variables."
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
};

async function fetchTable(tableName, params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    tableName
  )}${params}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch ${tableName}: ${res.status} ${res.statusText}\n${text}`
    );
  }

  const json = await res.json();
  return json.records;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCards(sections) {
  return sections
    .sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0))
    .map((rec) => {
      const f = rec.fields;
      const title = escapeHtml(f.Title ?? "");
      const body = escapeHtml(f.Body ?? "");
      const highlightClass = f.Highlight ? " card highlight" : "";

      const bullets = [f["Bullet 1"], f["Bullet 2"], f["Bullet 3"]]
        .filter(Boolean)
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join("");

      const bulletsHtml = bullets ? `<ul>${bullets}</ul>` : "";

      return `
    <section class="card${highlightClass}">
      <h2>${title}</h2>
      <p>${body}</p>
      ${bulletsHtml}
    </section>`;
    })
    .join("\n");
}

async function main() {
  console.log("📡 Fetching content from Airtable...");

  const globalsRecords = await fetchTable(GLOBALS_TABLE, "?maxRecords=1");
  const sectionsRecords = await fetchTable(SECTIONS_TABLE);

  const globals = globalsRecords[0]?.fields ?? {};

  const heroTitle = escapeHtml(globals["Hero Title"] || "");
  const heroSubtitle = escapeHtml(globals["Hero Subtitle"] || "");
  const footerText = escapeHtml(globals["Footer Text"] || "");
  const seoTitle =
    escapeHtml(globals["SEO Title"]) || heroTitle || "Simple Web";
  const seoDescription = escapeHtml(globals["SEO Description"] || "");

  const cardsHtml = renderCards(sectionsRecords);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDescription}">
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="container">
      <h1>${heroTitle}</h1>
      <p class="subtitle">${heroSubtitle}</p>
    </div>
  </header>

  <main class="container">
    ${cardsHtml}
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>${footerText}</p>
    </div>
  </footer>
</body>
</html>`;

  await fs.mkdir("public", { recursive: true });
  await fs.writeFile("public/index.html", html, "utf8");
  console.log("✅ index.html generated from Airtable");
}

main().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
