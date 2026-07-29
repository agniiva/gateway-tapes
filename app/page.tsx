"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BatteryMedium,
  BookOpenText,
  ListMusic,
  ListRestart,
  Pause,
  Play,
  Share2,
  SignalHigh,
  SkipBack,
  SkipForward,
  Star,
  Wifi,
  X,
} from "lucide-react";
import PdfReader from "./components/PdfReader";

type Track = { id: string; title: string; duration: number; src?: string };
type Album = { id: string; roman: string; title: string; color: string; manualPages: number; tracks: Track[] };
type MediaAsset = { trackId: string; fileName: string; size: number; updatedAt: string; url: string };

const ALBUMS: Album[] = [
  {
    id: "wave-i", roman: "I", title: "Discovery", color: "#4b5fa2", manualPages: 16,
    tracks: [
      ["orientation", "Orientation", 2208], ["focus-10", "Introduction to Focus 10", 2250],
      ["advanced-focus-10", "Advanced Focus 10", 2142], ["release-recharge", "Release and Recharge", 2236],
      ["exploration-sleep", "Exploration, Sleep", 2155], ["free-flow-10", "Free Flow 10", 2310],
    ].map(([id, title, duration]) => ({ id: `wave-i-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-ii", roman: "II", title: "Threshold", color: "#9e5847", manualPages: 10,
    tracks: [
      ["focus-12", "Introduction to Focus 12", 2234], ["problem-solving", "Problem Solving", 2206],
      ["month-patterning", "One-Month Patterning", 2291], ["color-breathing", "Color Breathing", 2168],
      ["energy-bar", "Energy Bar Tool", 2225], ["living-body-map", "Living Body Map", 2282],
    ].map(([id, title, duration]) => ({ id: `wave-ii-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-iii", roman: "III", title: "Freedom", color: "#788653", manualPages: 11,
    tracks: [
      ["lift-off", "Lift Off", 2210], ["remote-viewing", "Remote Viewing", 2320],
      ["vectors", "Vectors", 2184], ["five-questions", "Five Questions", 2288],
      ["energy-food", "Energy Food", 2165], ["separation", "First Stage Separation", 2255],
    ].map(([id, title, duration]) => ({ id: `wave-iii-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-iv", roman: "IV", title: "Adventure", color: "#b08b42", manualPages: 8,
    tracks: [
      ["year-patterning", "One-Year Patterning", 2295], ["five-messages", "Five Messages", 2198],
      ["free-flow-12", "Free Flow 12", 2244], ["nvc-i", "Nonverbal Communication I", 2216],
      ["nvc-ii", "Nonverbal Communication II", 2189], ["compoint", "Compoint", 2262],
    ].map(([id, title, duration]) => ({ id: `wave-iv-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-v", roman: "V", title: "Exploring", color: "#607d86", manualPages: 9,
    tracks: [
      ["advanced-focus-12", "Advanced Focus 12", 2226], ["discovering-intuition", "Discovering Intuition", 2290],
      ["exploring-intuition", "Exploring Intuition", 2268], ["focus-15", "Introduction to Focus 15", 2315],
      ["mission-15", "Mission 15", 2248], ["exploring-focus-15", "Exploring Focus 15", 2330],
    ].map(([id, title, duration]) => ({ id: `wave-v-${id}`, title: String(title), duration: Number(duration) })),
  },
  {
    id: "wave-vi", roman: "VI", title: "Odyssey", color: "#6d597b", manualPages: 11,
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

function formatDeviceTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
    .formatToParts(new Date())
    .filter((part) => part.type !== "dayPeriod")
    .map((part) => part.value)
    .join("")
    .trim();
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
  const [autoplay, setAutoplay] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [openAlbumId, setOpenAlbumId] = useState(ALBUMS[0].id);
  const [shared, setShared] = useState(false);
  const [deviceTime, setDeviceTime] = useState(formatDeviceTime);
  const [isSeeking, setIsSeeking] = useState(false);
  const [ready, setReady] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [uploadedSources, setUploadedSources] = useState<Record<string, string>>({});
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [manualWaveId, setManualWaveId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const discRef = useRef<HTMLDivElement | null>(null);
  const discRotation = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);
  const seekWasPlaying = useRef(false);
  const rangeSeekStart = useRef({ progress: 0, rotation: 0 });
  const discScrub = useRef<{ pointerId: number; lastAngle: number } | null>(null);
  const savedProgress = useRef<Record<string, number>>({});
  const lastSavedAt = useRef(0);
  const autoplayRef = useRef(false);
  const advanceRef = useRef<() => void>(() => undefined);

  const current = useMemo(() => findTrack(trackId), [trackId]);
  const currentSrc = uploadedSources[trackId] ?? current.track.src;
  const duration = mediaDuration || current.track.duration;
  const percentage = Math.min(100, (progress / duration) * 100);
  const favorite = favorites.includes(trackId);
  const openAlbum = ALBUMS.find((album) => album.id === openAlbumId) ?? ALBUMS[0];
  const manualAlbum = manualWaveId ? ALBUMS.find((album) => album.id === manualWaveId) : null;

  useEffect(() => {
    const updateTime = () => setDeviceTime(formatDeviceTime());
    updateTime();
    const clock = window.setInterval(updateTime, 15000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    fetch("/api/media")
      .then((response) => response.json() as Promise<{ assets?: MediaAsset[] }>)
      .then(({ assets = [] }) => {
        setUploadedSources(Object.fromEntries(assets.map((asset) => [asset.trackId, asset.url])));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const state = JSON.parse(raw) as { trackId?: string; progress?: Record<string, number>; autoplay?: boolean; favorites?: string[] };
          const fallbackId = ALBUMS[0].tracks[0].id;
          const restoredId = state.trackId && findTrack(state.trackId).track.id === state.trackId ? state.trackId : fallbackId;
          savedProgress.current = state.progress ?? {};
          setTrackId(restoredId);
          setProgress(savedProgress.current[restoredId] ?? 0);
          if (typeof state.autoplay === "boolean") setAutoplay(state.autoplay);
          if (Array.isArray(state.favorites)) setFavorites(state.favorites);
        }
      } catch {
        savedProgress.current = {};
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(restore);
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
      autoplay,
      favorites,
    }));
  }, [autoplay, favorites, isPlaying, progress, ready, trackId]);

  useEffect(() => {
    if (!isPlaying || currentSrc) return;
    const clock = window.setInterval(() => {
      setProgress((value) => {
        if (value >= duration) {
          if (autoplayRef.current) window.setTimeout(() => advanceRef.current(), 0);
          else setIsPlaying(false);
          return duration;
        }
        return Math.min(duration, value + 0.25);
      });
    }, 250);
    return () => window.clearInterval(clock);
  }, [currentSrc, duration, isPlaying]);

  const setDiscAngle = (angle: number) => {
    discRotation.current = angle;
    discRef.current?.style.setProperty("--disc-angle", `${angle}deg`);
  };

  useEffect(() => {
    if (!isPlaying || isSeeking) return;
    const rotate = (now: number) => {
      if (lastFrame.current !== null) {
        const elapsed = Math.min(now - lastFrame.current, 64);
        setDiscAngle(discRotation.current + elapsed * (360 / 3800));
      }
      lastFrame.current = now;
      animationFrame.current = window.requestAnimationFrame(rotate);
    };
    lastFrame.current = null;
    animationFrame.current = window.requestAnimationFrame(rotate);
    return () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      lastFrame.current = null;
    };
  }, [isPlaying, isSeeking]);

  const selectTrack = (nextId: string, continuePlaying = false) => {
    savedProgress.current[trackId] = progress;
    savedProgress.current[nextId] = 0;
    setIsPlaying(continuePlaying);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setTrackId(nextId);
    setMediaDuration(0);
    setProgress(0);
    setOpenAlbumId(findTrack(nextId).album.id);
    setLibraryOpen(false);
    setShowMiniPlayer(true);
    setDiscAngle(0);
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    setShowMiniPlayer(true);
    if (currentSrc && audioRef.current) {
      try {
        audioRef.current.currentTime = progress;
        await audioRef.current.play();
      } catch {
        setIsPlaying(false);
        return;
      }
    }
    setIsPlaying(true);
  };

  const seek = (value: number) => {
    setProgress(value);
    if (isSeeking) {
      const fractionMoved = (value - rangeSeekStart.current.progress) / Math.max(duration, 1);
      setDiscAngle(rangeSeekStart.current.rotation + fractionMoved * 1080);
    }
    if (audioRef.current && currentSrc) audioRef.current.currentTime = value;
  };

  const beginSeeking = () => {
    seekWasPlaying.current = isPlaying;
    rangeSeekStart.current = { progress, rotation: discRotation.current };
    audioRef.current?.pause();
    setIsPlaying(false);
    setIsSeeking(true);
    if ("vibrate" in navigator) navigator.vibrate(7);
  };

  const endSeeking = () => {
    setIsSeeking(false);
    if (!seekWasPlaying.current) return;
    seekWasPlaying.current = false;
    if (currentSrc && audioRef.current) {
      void audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else setIsPlaying(true);
  };

  const pointerAngle = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2)) * 180 / Math.PI;
  };

  const beginDiscScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginSeeking();
    discScrub.current = { pointerId: event.pointerId, lastAngle: pointerAngle(event) };
  };

  const moveDiscScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!discScrub.current || discScrub.current.pointerId !== event.pointerId) return;
    const angle = pointerAngle(event);
    let delta = angle - discScrub.current.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    discScrub.current.lastAngle = angle;
    setDiscAngle(discRotation.current + delta);
    setProgress((value) => {
      const next = Math.max(0, Math.min(duration, value + (delta / 360) * 20));
      if (audioRef.current && currentSrc) audioRef.current.currentTime = next;
      return next;
    });
  };

  const endDiscScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!discScrub.current || discScrub.current.pointerId !== event.pointerId) return;
    discScrub.current = null;
    endSeeking();
  };

  const adjacentTrack = (direction: -1 | 1, continuePlaying = false) => {
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
    selectTrack(nextAlbum.tracks[nextIndex].id, continuePlaying);
  };

  useEffect(() => {
    autoplayRef.current = autoplay;
    advanceRef.current = () => adjacentTrack(1, true);
  });

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
  const discStyle = { "--disc-angle": "0deg" } as CSSProperties;

  return (
    <main className="gateway-shell" style={recordStyle}>
      <section className="phone" aria-label="Gateway Tapes audio player">
        <div className="screen">
          <audio
            ref={audioRef}
            src={currentSrc}
            preload="metadata"
            onLoadedMetadata={(event) => setMediaDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
            onCanPlay={(event) => { if (isPlaying) void event.currentTarget.play(); }}
            onEnded={() => autoplay ? adjacentTrack(1, true) : setIsPlaying(false)}
          />

          <div className="status-bar" aria-hidden="true">
            <span suppressHydrationWarning>{deviceTime}</span>
            <span className="status-icons"><SignalHigh /><Wifi /><BatteryMedium /></span>
          </div>
          <div className="island" aria-hidden="true"><span></span></div>

          <header className="player-header">
            <button className="icon-button" aria-label="Open albums" onClick={() => setLibraryOpen(true)}><ArrowLeft /></button>
            <span className="album-label">Wave {current.album.roman} — {current.album.title}</span>
            <button className="icon-button" aria-label={shared ? "Link copied" : "Share session"} onClick={share}><Share2 /></button>
          </header>

          <div
            ref={discRef}
            className={`disc ${isSeeking ? "is-seeking" : ""}`}
            style={discStyle}
            role="slider"
            tabIndex={0}
            aria-label="Scrub the recording by turning the disc"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(progress)}
            onPointerDown={beginDiscScrub}
            onPointerMove={moveDiscScrub}
            onPointerUp={endDiscScrub}
            onPointerCancel={endDiscScrub}
          >
            <span className="disc-mark mark-one"></span><span className="disc-hole"></span><span className="disc-mark mark-two"></span>
          </div>

          <section className="track-block">
            <div className="track-heading">
              <div><h1>{current.track.title}</h1><p>The Gateway Experience</p></div>
              <button className={`favorite ${favorite ? "active" : ""}`} aria-label={favorite ? "Remove favorite" : "Add favorite"} aria-pressed={favorite} onClick={toggleFavorite}><Star fill={favorite ? "currentColor" : "none"} /></button>
            </div>
          </section>

          <section className="seek-block" aria-label="Playback position">
            <div className="progress-rail" aria-hidden="true">
              <span className="elapsed-bar" style={{ width: `${percentage}%` }}></span>
              <span className="remaining-ticks">{TICKS.map((_, index) => <i key={index}></i>)}</span>
            </div>
            <input
              aria-label="Seek through session"
              type="range"
              min="0"
              max={duration}
              step="1"
              value={progress}
              onPointerDown={(event) => { beginSeeking(); event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerUp={endSeeking}
              onPointerCancel={endSeeking}
              onBlur={() => { if (isSeeking) endSeeking(); }}
              onChange={(event) => seek(Number(event.target.value))}
            />
            <div className="times"><span>{formatTime(progress)}</span><span>−{formatTime(duration - progress)}</span></div>
          </section>

          <nav className="transport" aria-label="Transport controls">
            <button aria-label="Previous session" onClick={() => adjacentTrack(-1)} className="transport-icon"><SkipBack fill="currentColor" /></button>
            <button aria-label={isPlaying ? "Pause" : "Play"} aria-pressed={isPlaying} onClick={togglePlayback} className="play-pause">
              {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
            </button>
            <button aria-label="Next session" onClick={() => adjacentTrack(1)} className="transport-icon"><SkipForward fill="currentColor" /></button>
          </nav>

          <div className="bottom-actions">
            <button className="action-icon" aria-label="Open library" onClick={() => setLibraryOpen(true)}><ListMusic /></button>
            <button className="action-icon" aria-label={`Open Wave ${current.album.roman} manual`} onClick={() => setManualWaveId(current.album.id)}><BookOpenText /></button>
            <button className={`action-icon autoplay ${autoplay ? "active" : ""}`} aria-label={autoplay ? "Turn autoplay off" : "Turn autoplay on"} aria-pressed={autoplay} onClick={() => setAutoplay((value) => !value)}><ListRestart /></button>
          </div>

          {libraryOpen && (
            <section className="library-panel" aria-label="Gateway Tapes library">
              <header><div><b>GATEWAY TAPES</b><span>06 WAVES · 36 SESSIONS</span></div></header>
              <div className="album-grid">
                {ALBUMS.map((album) => (
                  <button key={album.id} className={`album-card ${openAlbumId === album.id ? "selected" : ""}`} onClick={() => setOpenAlbumId(album.id)}>
                    <span className="album-art" style={{ background: album.color }}><i></i><b>{album.roman}</b></span>
                    <span>WAVE {album.roman}</span><strong>{album.title}</strong>
                  </button>
                ))}
              </div>
              <div className="track-list">
                <div className="track-list-heading">
                  <h2>Wave {openAlbum.roman} — {openAlbum.title}</h2>
                  <button aria-label={`Open Wave ${openAlbum.roman} manual`} onClick={() => setManualWaveId(openAlbum.id)}><BookOpenText /><span>MANUAL</span></button>
                </div>
                {openAlbum.tracks.map((track, index) => (
                  <div key={track.id} className={`track-row ${track.id === trackId ? "current" : ""}`}>
                    <button className="track-select" onClick={() => selectTrack(track.id, true)}>
                      <span>{String(index + 1).padStart(2, "0")}</span><b>{track.title}</b><em>{formatTime(track.duration)}</em>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {manualAlbum && (
            <PdfReader
              key={manualAlbum.id}
              waveId={manualAlbum.id}
              label={`Wave ${manualAlbum.roman} — ${manualAlbum.title}`}
              pages={manualAlbum.manualPages}
              miniPlayerVisible={showMiniPlayer}
              onClose={() => setManualWaveId(null)}
            />
          )}

          {(libraryOpen || manualAlbum) && showMiniPlayer && (
            <section className="now-playing" aria-label="Now playing">
              <button className="now-playing-track" onClick={() => { setLibraryOpen(false); setManualWaveId(null); }}>
                <span className="mini-disc" style={{ background: current.album.color }}><i></i></span>
                <span><small>{isPlaying ? "NOW PLAYING" : "PAUSED"}</small><b>{current.track.title}</b></span>
              </button>
              <button className="now-playing-toggle" aria-label={isPlaying ? "Pause" : "Resume"} onClick={togglePlayback}>{isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
              <button className="now-playing-close" aria-label="Dismiss player" onClick={() => { audioRef.current?.pause(); setIsPlaying(false); setShowMiniPlayer(false); }}><X /></button>
            </section>
          )}
        </div>
      </section>

      <aside className="about-panel">
        <p className="eyebrow">PRIVATE LISTENING LIBRARY</p>
        <h2>Gateway Tapes</h2>
        <p className="lead">A mobile-first home for six waves of the Gateway Experience—thirty-six sessions, one focused listening system.</p>

        <div className="about-section">
          <h3>About Hemi-Sync</h3>
          <p>Hemi-Sync is an audio-guidance method associated with the Monroe Institute. It uses layered sound and spoken exercises to support focused, relaxed states of awareness.</p>
        </div>

        <p className="disclaimer">Personal, non-commercial archive. Not affiliated with or endorsed by the Monroe Institute.</p>
      </aside>
    </main>
  );
}
