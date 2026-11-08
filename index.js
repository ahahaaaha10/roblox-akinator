
const express = require("express");
const {
  AkinatorClient,
  Languages,
  Themes
} = require("akinator-client");

const app = express();
app.use(express.json());

function inspectHTML(html) {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 120) || "No title found";

  const excerpt = html
    .slice(0, 5000)
    .replace(
      /(session|signature)(["'\s:=]+)[^"'&\s<>]*/gi,
      "$1$2[REDACTED]"
    )
    .replace(
      /(set-cookie:?\s*)[^\r\n<]*/gi,
      "$1[REDACTED]"
    );

  return {
    title,
    excerpt,
    hasSession: /session/i.test(html),
    hasSignature: /signature/i.test(html),
    hasSid: /\bsid\b/i.test(html)
  };
}

app.post("/diagnose", async (req, res) => {
  try {
    const { gotScraping } = await import("got-scraping");
    const base = "https://en.akinator.com";

    const homepage = await gotScraping(base + "/", {
      responseType: "text",
      throwHttpErrors: false
    });

    const cookies = homepage.headers["set-cookie"] || [];
    const cookieHeader = cookies
      .map(c => c.split(";")[0])
      .join("; ");

    const game = await gotScraping(base + "/game", {
      method: "POST",
      form: {
        sid: "1",
        cm: "1"
      },
      headers: {
        Referer: base + "/",
        Origin: base,
        ...(cookieHeader
          ? { Cookie: cookieHeader }
          : {})
      },
      responseType: "text",
      throwHttpErrors: false
    });

    const info = inspectHTML(game.body);

    res.json({
      homepage: {
        status: homepage.statusCode,
        contentType: homepage.headers["content-type"]
      },
      game: {
        status: game.statusCode,
        contentType: game.headers["content-type"],
        finalUrl: game.url,
        title: info.title,
        hasSession: info.hasSession,
        hasSignature: info.hasSignature,
        hasSid: info.hasSid,
        excerpt: info.excerpt
      }
    });

  } catch (error) {
    console.error("DIAGNOSTIC ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/start", async (req, res) => {
  try {
    const aki = new AkinatorClient({
      language: Languages.English,
      theme: Themes.Character,
      childMode: true,
      retries: 1
    });

    const result = await aki.start();

    res.json({
      success: true,
      question: result.question
    });

  } catch (error) {
    console.error("AKI ERROR:", error.stack || error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Akinator backend online");
});

app.listen(process.env.PORT || 3000);
