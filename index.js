import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// ===== Spotify Token Cache ===========================================
let spotifyToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  // Returnera cached token om den fortfarande är giltig
  if (spotifyToken && Date.now() < spotifyTokenExpiry) {
    return spotifyToken;
  }

  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64")
      },
      body: "grant_type=client_credentials"
    });

    const data = await response.json();
    spotifyToken = data.access_token;
    // Token giltig i ~1 timme, vi cachar i 50 minuter
    spotifyTokenExpiry = Date.now() + (50 * 60 * 1000);
    return spotifyToken;
  } catch (error) {
    console.error("Spotify token error:", error);
    return null;
  }
}

app.get("/", (req, res) => {
  res.json({ status: "OK – Tidsmaskin backend körs 🔧" });
});

// ===== Spotify Search ================================================
app.get("/spotify", async (req, res) => {
  try {
    const { title, artist } = req.query;
    if (!title || !artist) {
      return res.status(400).json({ error: "Missing ?title=...&artist=..." });
    }

    const token = await getSpotifyToken();
    if (!token) {
      return res.json({ trackId: null, error: "Could not get Spotify token" });
    }

    // Rensa söksträngen
    const cleanTitle = title.replace(/\(.*?\)/g, "").trim();
    const cleanArtist = artist.split("ft.")[0].split("feat.")[0].split("&")[0].trim();

    // Första sökning: specifik
    const query = encodeURIComponent(`track:${cleanTitle} artist:${cleanArtist}`);
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );

    const data = await response.json();

    if (data.tracks?.items?.length > 0) {
      return res.json({ 
        trackId: data.tracks.items[0].id,
        name: data.tracks.items[0].name,
        artist: data.tracks.items[0].artists[0]?.name
      });
    }

    // Fallback: enklare sökning
    const simpleQuery = encodeURIComponent(`${cleanTitle} ${cleanArtist}`);
    const fallbackResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${simpleQuery}&type=track&limit=1`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );

    const fallbackData = await fallbackResponse.json();

    if (fallbackData.tracks?.items?.length > 0) {
      return res.json({ 
        trackId: fallbackData.tracks.items[0].id,
        name: fallbackData.tracks.items[0].name,
        artist: fallbackData.tracks.items[0].artists[0]?.name
      });
    }

    return res.json({ trackId: null });

  } catch (err) {
    console.error("Spotify search error:", err);
    return res.json({ trackId: null, error: err.message });
  }
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
