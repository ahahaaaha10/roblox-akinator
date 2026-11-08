
const express = require("express");
const {
  AkinatorClient,
  Languages,
  Themes,
  Answers
} = require("akinator-client");

const app = express();
app.use(express.json());

const games = new Map();

app.post("/start", async (req, res) => {
  try {
    const aki = new AkinatorClient({
      language: Languages.English,
      theme: Themes.Character,
      childMode: true
    });

    await aki.start();

    const id = crypto.randomUUID();
    games.set(id, aki);

    res.json({
      id,
      question: aki.question
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/answer", async (req, res) => {
  try {
    const aki = games.get(req.body.id);
    if (!aki) return res.status(404).json({
      error: "Game not found"
    });

    const answers = [
      Answers.Yes,
      Answers.No,
      Answers.IDontKnow,
      Answers.Probably,
      Answers.ProbablyNot
    ];

    const answer = Number(req.body.answer);
    if (!Number.isInteger(answer) || answer < 0 || answer > 4) {
      return res.status(400).json({ error: "Invalid answer" });
    }

    const result = await aki.answer(answers[answer]);

    res.json({
      question: result.question,
      won: result.won,
      guess: result.won ? aki.winResult.name : null,
      progression: result.progression
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.send("Akinator backend online");
});

const crypto = require("crypto");

app.listen(process.env.PORT || 3000);
