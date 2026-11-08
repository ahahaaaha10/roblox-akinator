
const express = require("express");
const {
  AkinatorClient,
  Languages,
  Themes
} = require("akinator-client");

const app = express();
app.use(express.json());

const BASE = "https://en.akinator.com";

function inspectHTML(html) {
  const sessionRegex =
    /name="session" id="session" value="([^"]+)"/;

  const signatureRegex =
    /name="signature" id="signature" value="([^"]+)"/;

  const inputTags = (html.match(/<input\b[^>]*>/gi) || [])
    .filter(tag => /name=["'](session|signature)["']/i.test(tag))
    .map(tag =>
      tag.replace(
        /value=(["']).*?\1/i,
        'value="[REDACTED]"'
      )
    );

  return {
    exactSessionMatch: sessionRegex.test(html),
    exactSignatureMatch: signatureRegex.test(html),
    sessionAnywhere: /name=["']session["']/i.test(html),
    signatureAnywhere: /name=["']signature["']/i.test(html),
    inputTags
  };
}

app.post("/diagnose", async (req, res) => {
  try {
    const { gotScraping } = await import("got-scraping");

    const headers = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    };

    const homepage = await gotScraping({
      url: BASE + "/",
      responseType: "text",
      throwHttpErrors: false,
      headers,
      context: { useHeaderGenerator: false }
    });

    const cookies = homepage.headers["set-cookie"] || [];
    const cookieHeader = cookies
      .map(cookie => cookie.split(";")[0])
      .join("; ");

    const form = new URLSearchParams();
    form.append("sid", "1");
    form.append("cm", "true");

    const game = await gotScraping({
      url: BASE + "/game",
      method: "POST",
      body: form.toString(),
      responseType: "text",
      throwHttpErrors: false,
      headers: {
        ...headers,
        "content-type": "application/x-www-form-urlencoded",
        ...(cookieHeader ? { cookie: cookieHeader } : {})
      },
      context: { useHeaderGenerator: false }
    });

    const info = inspectHTML(game.body);

    res.json({
      homepageStatus: homepage.statusCode,
      gameStatus: game.statusCode,
      finalUrl: game.url,
      contentType: game.headers["content-type"],
      ...info
    });

  } catch (error) {
    console.error("DIAGNOSTIC ERROR:", error.stack || error.message);
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
      question: result.question,
      answers: result.answers
    });

  } catch (error) {
    console.error("AKI ERROR:", error.stack || error.message);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Akinator backend online");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Akinator backend started");
});
