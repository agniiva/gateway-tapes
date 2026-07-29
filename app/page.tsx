"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Track = { id: string; title: string; duration: number; src?: string };
type Album = { id: string; roman: string; title: string; color: string; tracks: Track[] };

const ALBUMS: Album[] = [
  {
    id: "wave-i", roman: "I", title: "Discovery", color: "#4b5fa2",
    tracks: [
      ["orientation", "Orientation", 2208], ["focus-10", "Introduction to Focus 10", 2250],
      ["advanced-focus-10", "Advanced Focus 10", 2142], ["release-recharge", "Release and Recharge", 2236],
      ["exploration-sleep", "Exploration, Sleep", 2155], ["free-flow-10", "Free Flow 10", 2310],
    ].map(([id, title, duration]) => ({ id: `wave-i-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-ii", roman: "II", title: "Threshold", color: "#9e5847",
    tracks: [
      ["focus-12", "Introduction to Focus 12", 2234], ["problem-solving", "Problem Solving", 2206],
      ["month-patterning", "One-Month Patterning", 2291], ["color-breathing", "Color Breathing", 2168],
      ["energy-bar", "Energy Bar Tool", 2225], ["living-body-map", "Living Body Map", 2282],
    ].map(([id, title, duration]) => ({ id: `wave-ii-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-iii", roman: "III", title: "Freedom", color: "#788653",
    tracks: [
      ["lift-off", "Lift Off", 2210], ["remote-viewing", "Remote Viewing", 2320],
      ["vectors", "Vectors", 2184], ["five-questions", "Five Questions", 2288],
      ["energy-food", "Energy Food", 2165], ["separation", "First Stage Separation", 2255],
    ].map(([id, title, duration]) => ({ id: `wave-iii-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-iv", roman: "IV", title: "Adventure", color: "#b08b42",
    tracks: [
      ["year-patterning", "One-Year Patterning", 2295], ["five-messages", "Five Messages", 2198],
      ["free-flow-12", "Free Flow 12", 2244], ["nvc-i", "Nonverbal Communication I", 2216],
      ["nvc-ii", "Nonverbal Communication II", 2189], ["compoint", "Compoint", 2262],
    ].map(([id, title, duration]) => ({ id: `wave-iv-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-v", roman: "V", title: "Exploring", color: "#607d86",
    tracks: [
      ["advanced-focus-12", "Advanced Focus 12", 2226], ["discovering-intuition", "Discovering Intuition", 2290],
      ["exploring-intuition", "Exploring Intuition", 2268], ["focus-15", "Introduction to Focus 15", 2315],
      ["mission-15", "Mission 15", 2248], ["exploring-focus-15", "Exploring Focus 15", 2330],
    ].map(([id, title, duration]) => ({ id: `wave-v-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-vi", roman: "VI", title: "Odyssey", color: "#6d597b",
    tracks: [
      ["locale-one", "Sensing Locale I", 2256], ["expansion-locale-one", "Expansion in Locale I", 2310],
      ["departure", "Point of Departure", 2224], ["friends", "Nonphysical Friends", 2266],
      ["locale-two", "Movement to Locale II", 2305], ["free-flow-21", "Free Flow Journey in Focus 21", 2350],
    ].map(([id, title, duration]) => ({ id: `wave-vi-${id}`, title: String(title), duration: Number(duration) })),
  },
];

const STORAGE_KEY = "gateway-tapes-player-state-v1";
const TICKS = Array.from({ length: 46 });

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function findTrack(trackId: string) {
  for (const album of ALBUMS) {
    const trackIndex = album.tracks.findIndex((track) => track.id === trackId);
    if (trackIndex >= 0) return { album, track: album.tracks[trackIndex], trackIndex };
  }
  return { album: ALBUMS[0], track: ALBUMS[0].tracks[0], trackIndex: 0 };
}

export default function Home() {
  const [trackId, setTrackId] = useState(ALBUMS[0].tracks[0].id);
  const [progress, setProgress] = useState(187);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [openAlbumId, setOpenAlbumId] = useState(ALBUMS[0].id);
  const [showVolume, setShowVolume] = useState(false);
  const [shared, setShared] = useState(false);
  const [ready, setReady] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savedProgress = useRef<Record<string, number>>({});
  const lastSavedAt = useRef(0);

  const current = useMemo(() => findTrack(trackId), [trackId]);
  const duration = mediaDuration || current.track.duration;
  const percentage = Math.min(100, (progress / duration) * 100);
  const favorite = favorites.includes(trackId);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as { trackId?: string; progress?: Record<string, number>; volume?: number; favorites?: string[] };
        const restoredId = state.trackId && findTrack(state.trackId).track.id === state.trackId ? state.trackId : trackId;
        savedProgress.current = state.progress ?? {};
        setTrackId(restoredId);
        setProgress(savedProgress.current[restoredId] ?? 0);
        if (typeof state.volume === "number") setVolume(state.volume);
        if (Array.isArray(state.favorites)) setFavorites(state.favorites);
      }
    } catch {
      savedProgress.current = {};
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const now = Date.now();
    if (isPlaying && now - lastSavedAt.current < 1000) return;
    lastSavedAt.current = now;
    savedProgress.current[trackId] = progress;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      trackId,
      progress: savedProgress.current,
      volume,
      favorites,
    }));
  }, [favorites, isPlaying, progress, ready, trackId, volume]);

  useEffect(() => {
    if (!isPlaying || current.track.src) return;
    const clock = window.setInterval(() => {
      setProgress((value) => {
        if (value >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return Math.min(duration, value + 0.25);
      });
    }, 250);
    return () => window.clearInterval(clock);
  }, [current.track.src, duration, isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const selectTrack = (nextId: string) => {
    savedProgress.current[trackId] = progress;
    setIsPlaying(false);
    audioRef.current?.pause();
    setTrackId(nextId);
    setMediaDuration(0);
    setProgress(savedProgress.current[nextId] ?? 0);
    setOpenAlbumId(findTrack(nextId).album.id);
    setLibraryOpen(false);
  };

  const togglePlayback = async () => {
    if (current.track.src && audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else {
        audioRef.current.currentTime = progress;
        await audioRef.current.play();
      }
    }
    setIsPlaying((value) => !value);
  };

  const seek = (value: number) => {
    setProgress(value);
    if (audioRef.current && current.track.src) audioRef.current.currentTime = value;
  };

  const adjacentTrack = (direction: -1 | 1) => {
    const albumIndex = ALBUMS.findIndex((album) => album.id === current.album.id);
    let nextAlbum = current.album;
    let nextIndex = current.trackIndex + direction;
    if (nextIndex < 0) {
      nextAlbum = ALBUMS[(albumIndex - 1 + ALBUMS.length) % ALBUMS.length];
      nextIndex = nextAlbum.tracks.length - 1;
    } else if (nextIndex >= current.album.tracks.length) {
      nextAlbum = ALBUMS[(albumIndex + 1) % ALBUMS.length];
      nextIndex = 0;
    }
    selectTrack(nextAlbum.tracks[nextIndex].id);
  };

  const share = async () => {
    try {
      const data = { title: `${current.track.title} — Gateway Tapes`, url: window.location.href };
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch { setShared(false); }
  };

  const toggleFavorite = () => {
    setFavorites((items) => items.includes(trackId) ? items.filter((id) => id !== trackId) : [...items, trackId]);
  };

  const recordStyle = { "--record": current.album.color } as CSSProperties;

  return (
    <main className="gateway-shell" style={recordStyle}>
      <section className="phone" aria-label="Gateway Tapes audio player">
        <div className="screen">
          <audio
            ref={audioRef}
            src={current.track.src}
            preload="metadata"
            onLoadedMetadata={(event) => setMediaDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
            onEnded={() => adjacentTrack(1)}
          />

          <div className="status-bar" aria-hidden="true">
            <span>9:41</span><span className="status-icons"><i></i><i></i><b></b></span>
          </div>
          <div className="island" aria-hidden="true"><span></span></div>

          <header className="player-header">
            <button className="icon-button back" aria-label="Open albums" onClick={() => setLibraryOpen(true)}><span></span></button>
            <span className="album-label">Wave {current.album.roman} — {current.album.title}</span>
            <button className="icon-button share" aria-label={shared ? "Link copied" : "Share session"} onClick={share}><span></span><span></span><span></span></button>
          </header>

          <div className={`disc ${isPlaying ? "is-playing" : ""}`} aria-label={isPlaying ? "Disc rotating" : "Disc paused"}>
            <span className="disc-mark mark-one"></span><span className="disc-hole"></span><span className="disc-mark mark-two"></span>
          </div>

          <section className="track-block">
            <div className="track-heading">
              <div><h1>{current.track.title}</h1><p>The Gateway Experience</p></div>
              <button className={`favorite ${favorite ? "active" : ""}`} aria-label={favorite ? "Remove favorite" : "Add favorite"} aria-pressed={favorite} onClick={toggleFavorite}><span>★</span></button>
            </div>
            <p className="credits">Wave {current.album.roman} · {current.album.title}<br />Private archive · FLAC-ready · state saved on this device</p>
          </section>

          <section className="seek-block" aria-label="Playback position">
            <div className="progress-rail" aria-hidden="true">
              <span className="elapsed-bar" style={{ width: `${percentage}%` }}></span>
              <span className="remaining-ticks">{TICKS.map((_, index) => <i key={index}></i>)}</span>
            </div>
            <input aria-label="Seek through session" type="range" min="0" max={duration} step="1" value={progress} onChange={(event) => seek(Number(event.target.value))} />
            <div className="times"><span>{formatTime(progress)}</span><span>−{formatTime(duration - progress)}</span></div>
          </section>

          <nav className="transport" aria-label="Transport controls">
            <button aria-label="Previous session" onClick={() => adjacentTrack(-1)} className="skip previous"><i></i><i></i><b></b></button>
            <button aria-label={isPlaying ? "Pause" : "Play"} aria-pressed={isPlaying} onClick={togglePlayback} className="play-pause">
              {isPlaying ? <span className="pause-symbol"><i></i><i></i></span> : <span className="play-symbol"></span>}
            </button>
            <button aria-label="Next session" onClick={() => adjacentTrack(1)} className="skip next"><i></i><i></i><b></b></button>
          </nav>

          <div className="bottom-actions">
            <button className={`queue-button ${libraryOpen ? "active" : ""}`} aria-label="Open library" onClick={() => setLibraryOpen(true)}><i></i><i></i><i></i><b></b><b></b><b></b></button>
            <button className="volume-button" aria-label="Toggle volume" aria-expanded={showVolume} onClick={() => setShowVolume((value) => !value)}><i></i><b></b><em></em></button>
          </div>

          {showVolume && !libraryOpen && (
            <div className="volume-panel">
              <label htmlFor="volume">VOL</label>
              <input id="volume" aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
              <span>{Math.round(volume * 100)}</span>
            </div>
          )}

          {libraryOpen && (
            <section className="library-panel" aria-label="Gateway Tapes library">
              <header><div><b>GATEWAY TAPES</b><span>06 WAVES · 36 SESSIONS</span></div><button aria-label="Close library" onClick={() => setLibraryOpen(false)}>×</button></header>
              <div className="album-grid">
                {ALBUMS.map((album) => (
                  <button key={album.id} className={`album-card ${openAlbumId === album.id ? "selected" : ""}`} onClick={() => setOpenAlbumId(album.id)}>
                    <span className="album-art" style={{ background: album.color }}><i></i><b>{album.roman}</b></span>
                    <span>WAVE {album.roman}</span><strong>{album.title}</strong>
                  </button>
                ))}
              </div>
              <div className="track-list">
                <h2>Wave {ALBUMS.find((album) => album.id === openAlbumId)?.roman} — {ALBUMS.find((album) => album.id === openAlbumId)?.title}</h2>
                {ALBUMS.find((album) => album.id === openAlbumId)?.tracks.map((track, index) => (
                  <button key={track.id} className={track.id === trackId ? "current" : ""} onClick={() => selectTrack(track.id)}>
                    <span>{String(index + 1).padStart(2, "0")}</span><b>{track.title}</b><em>{formatTime(track.duration)}</em>
                  </button>
                ))}
              </div>
              <p className="library-note">Cover art and FLAC files can replace these placeholders without changing the player.</p>
            </section>
          )}
        </div>
      </section>

      <aside className="about-panel">
        <p className="eyebrow">HOBBY PROJECT / PRIVATE AUDIO LIBRARY</p>
        <h2>Gateway Tapes</h2>
        <p className="lead">A mobile-first home for six waves of the Gateway Experience—thirty-six sessions, one focused listening system.</p>

        <div className="about-section">
          <h3>About Hemi-Sync</h3>
          <p>Hemi-Sync is an audio-guidance method associated with the Monroe Institute. It uses layered sound and spoken exercises to support focused, relaxed states of awareness.</p>
        </div>

        <div className="about-section">
          <h3>Built for continuity</h3>
          <p>The selected session, listening position, volume and favorites stay saved on this device, so every visit resumes where the last one ended.</p>
        </div>

        <div className="project-counts"><span>06 ALBUMS</span><span>36 SESSIONS</span><span>FLAC READY</span></div>
        <p className="disclaimer">Personal, non-commercial archive. Not affiliated with or endorsed by the Monroe Institute.</p>
      </aside>
    </main>
  );
}
