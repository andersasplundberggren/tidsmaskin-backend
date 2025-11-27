import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.json({ status: "OK – Tidsmaskin backend körs 🔧" });
});

// ===== TMDb ====================================================
app.get("/movie", async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "Missing ?date=YYYY-MM-DD" });

    const apiKey = process.env.TMDB_API_KEY;
    const d = new Date(date);
    const weekBefore = new Date(d);
    weekBefore.setDate(weekBefore.getDate() - 14);

    const url =
      `https://api.themoviedb.org/3/discover/movie` +
      `?api_key=${apiKey}` +
      `&primary_release_date.gte=${weekBefore.toISOString().split("T")[0]}` +
      `&primary_release_date.lte=${date}` +
      `&sort_by=popularity.desc` +
      `&language=sv-SE`;

    const data = await fetch(url).then(r => r.json());

    if (!data.results?.length) return res.json(null);

    const movie = data.results[0];

    // Fetch trailer
    const trailerURL = `https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${apiKey}&language=en-US`;
    const videoData = await fetch(trailerURL).then(r => r.json());

    const trailer = videoData.results?.find(v => v.type === "Trailer" && v.site === "YouTube");

    return res.json({
      titel: movie.title,
      beskrivning: movie.overview,
      betyg: movie.vote_average,
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      trailer: trailer ? { key: trailer.key } : null
    });
  } catch (err) {
    console.error("TMDb error:", err);
    return res.json(null);
  }
});

// ===== NASA APOD ====================================================
app.get("/nasa", async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "Missing ?date=" });

    const apiKey = process.env.NASA_API_KEY;
    const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}&date=${date}`;

    const data = await fetch(url).then(r => r.json());
    return res.json(data);
  } catch (err) {
    console.error("NASA error:", err);
    return res.json(null);
  }
});

// ===== Open Meteo ====================================================
app.get("/weather", async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "Missing ?date=" });

    const url =
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=59.3293&longitude=18.0686` +
      `&start_date=${date}&end_date=${date}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
      `&timezone=Europe/Stockholm`;

    const data = await fetch(url).then(r => r.json());
    return res.json(data);
  } catch (err) {
    console.error("Weather error:", err);
    return res.json(null);
  }
});

// ===== Frankfurter FX ====================================================
app.get("/fx", async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "Missing ?date=" });

    const url = `https://api.frankfurter.app/${date}?from=USD&to=SEK`;

    const data = await fetch(url).then(r => r.json());
    return res.json(data);
  } catch (err) {
    console.error("FX error:", err);
    return res.json(null);
  }
});

// ===== Wikimedia On This Day ==========================================
app.get("/onthisday", async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "Missing ?date=" });

    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    const url = `https://api.wikimedia.org/feed/v1/wikipedia/sv/onthisday/events/${month}/${day}`;
    const data = await fetch(url).then(r => r.json());
    return res.json(data);
  } catch (err) {
    console.error("On this day error:", err);
    return res.json(null);
  }
});

// ===== Wikimedia Births ===============================================
app.get("/birthdays", async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "Missing ?date=" });

    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    const url = `https://api.wikimedia.org/feed/v1/wikipedia/sv/onthisday/births/${month}/${day}`;
    const data = await fetch(url).then(r => r.json());
    return res.json(data);
  } catch (err) {
    console.error("On this day birthdays error:", err);
    return res.json(null);
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Tidsmaskin backend kör på port", PORT));
