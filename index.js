
const express = require("express");
const Akinator = require("silent-akinator-pro");

const app = express();
app.use(express.json());

const games = new Map();
let nextId = 1;

app.post("/start", async (req, res) => {
  try {
    const aki = new Akinator({
      region: "en",
      childMode: true
    });

    await aki.start();

    const id = String(nextId++);
    games.set(id, aki);

    res.json({
      success: true,
      gameId: id,
      question: aki.question,
      step: aki.step,
      progression: aki.progression
    });
  } catch (error) {
    console.error("START ERROR:", error.stack || error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/answer", async (req, res) => {
  try {
    const { gameId, answer } = req.body;
    const aki = games.get(String(gameId));

    if (!aki) {
      return res.status(404).json({
        success: false,
        error: "Game not found"
      });
    }

    const valid = ["y", "n", "idk", "p", "pn"];

    if (!valid.includes(answer)) {
      return res.status(400).json({
        success: false,
        error: "Invalid answer"
      });
    }

    const result = await aki.answer(answer);

    res.json({
      success: true,
      question: aki.question,
      step: aki.step,
      progression: aki.progression,
      guessed: aki.guessed,
      guess: aki.guessed ? aki.guess : null,
      result
    });
  } catch (error) {
    console.error("ANSWER ERROR:", error.stack || error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/exclude", async (req, res) => {
  try {
    const aki = games.get(String(req.body.gameId));

    if (!aki) {
      return res.status(404).json({
        success: false,
        error: "Game not found"
      });
    }

    await aki.exclude();

    res.json({
      success: true,
      question: aki.question,
      step: aki.step
    });
  } catch (error) {
    console.error("EXCLUDE ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/back", async (req, res) => {
  try {
    const aki = games.get(String(req.body.gameId));

    if (!aki) {
      return res.status(404).json({
        success: false,
        error: "Game not found"
      });
    }

    await aki.back();

    res.json({
      success: true,
      question: aki.question,
      step: aki.step
    });
  } catch (error) {
    console.error("BACK ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Silent Akinator backend online");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Akinator backend running");
});
