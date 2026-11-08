const express = require("express");
const { AkinatorClient, Languages, Themes } =
  require("akinator-client");

const app = express();

app.post("/start", async (req, res) => {
  try {
    const aki = new AkinatorClient({
      language: Languages.English,
      theme: Themes.Character,
      childMode: true,
      retries: 3
    });

    const result = await aki.start();

    res.json({
      success: true,
      question: result.question
    });
  } catch (e) {
    console.error("AKI ERROR:", e.stack || e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.send("Akinator backend online"));

app.listen(process.env.PORT || 3000);