"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BatteryMedium,
  BookOpenText,
  Download,
  ListMusic,
  Pause,
  Play,
  Share2,
  SignalHigh,
  Star,
  Wifi,
  X,
} from "lucide-react";
import { captureAnalytics, type AnalyticsProperties, type GatewayAnalyticsEvent } from "../analytics";
import PdfReader from "./PdfReader";

type Track = { id: string; title: string; duration: number; src?: string };
type Album = { id: string; roman: string; title: string; color: string; manualPages: number; tracks: Track[] };
type MediaAsset = { trackId: string; fileName: string; size: number; updatedAt: string; url: string };
type ScratchAudio = { context: AudioContext; noise: AudioBuffer; lastBurstAt: number };

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
const MAX_RECOVERY_ATTEMPTS = 5;
const STALL_RECOVERY_DELAY_MS = 4000;

function playbackClock() {
  return performance.now();
}

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

function TenSecondIcon({ direction }: { direction: "back" | "forward" }) {
  const backwards = direction === "back";
  return (
    <>
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path className="seek-ring" d={backwards ? "M4.5 25A19.5 19.5 0 1 0 17 6.9" : "M43.5 25A19.5 19.5 0 1 1 31 6.9"} />
        <path className="seek-arrow" d={backwards ? "M1.5 9.7 18.5 1.8v15.8Z" : "M46.5 9.7 29.5 1.8v15.8Z"} />
      </svg>
      <span aria-hidden="true">10</span>
    </>
  );
}

export default function Home() {
  const [trackId, setTrackId] = useState(ALBUMS[0].tracks[0].id);
  const [progress, setProgress] = useState(187);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
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
  const [streamAttempt, setStreamAttempt] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const discRef = useRef<HTMLDivElement | null>(null);
  const discRotation = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);
  const seekWasPlaying = useRef(false);
  const rangeSeekStart = useRef({ progress: 0, rotation: 0 });
  const discScrub = useRef<{ pointerId: number; lastAngle: number; lastMovedAt: number } | null>(null);
  const scratchAudio = useRef<ScratchAudio | null>(null);
  const lastScrubHapticAt = useRef(0);
  const savedProgress = useRef<Record<string, number>>({});
  const lastSavedAt = useRef(0);
  const seekMethod = useRef<"rail" | "disc">("rail");
  const lastPlayingCapture = useRef({ trackId: "", at: 0 });
  const lastBufferingCapture = useRef(0);
  const shouldBePlaying = useRef(false);
  const seekingRef = useRef(false);
  const suppressPauseRecovery = useRef(false);
  const progressRef = useRef(progress);
  const lastProgressAt = useRef(0);
  const recoveryTimer = useRef<number | null>(null);
  const recoveryPosition = useRef<number | null>(null);
  const recoveryReason = useRef<string | null>(null);
  const recoveryAttempts = useRef(0);
  const scheduleRecoveryRef = useRef<(reason: string) => void>(() => undefined);

  const current = useMemo(() => findTrack(trackId), [trackId]);
  const currentSrc = uploadedSources[trackId] ?? current.track.src;
  const playbackSrc = useMemo(() => {
    if (!currentSrc || streamAttempt === 0) return currentSrc;
    return `${currentSrc}${currentSrc.includes("?") ? "&" : "?"}stream_attempt=${streamAttempt}`;
  }, [currentSrc, streamAttempt]);
  const duration = mediaDuration || current.track.duration;
  const percentage = Math.min(100, (progress / duration) * 100);
  const favorite = favorites.includes(trackId);
  const openAlbum = ALBUMS.find((album) => album.id === openAlbumId) ?? ALBUMS[0];
  const manualAlbum = manualWaveId ? ALBUMS.find((album) => album.id === manualWaveId) : null;

  const trackProperties = (id = trackId): AnalyticsProperties => {
    const selection = findTrack(id);
    return {
      wave_id: selection.album.id,
      wave_number: selection.album.roman,
      wave_title: selection.album.title,
      session_id: selection.track.id,
      session_number: selection.trackIndex + 1,
      session_title: selection.track.title,
      duration_seconds: selection.track.duration,
    };
  };

  const captureTrackEvent = (event: GatewayAnalyticsEvent, properties?: AnalyticsProperties, id = trackId) => {
    captureAnalytics(event, { ...trackProperties(id), ...properties });
  };

  const clearRecoveryTimer = () => {
    if (recoveryTimer.current !== null) window.clearTimeout(recoveryTimer.current);
    recoveryTimer.current = null;
  };

  const resetRecovery = () => {
    clearRecoveryTimer();
    recoveryPosition.current = null;
    recoveryReason.current = null;
    recoveryAttempts.current = 0;
  };

  const pauseIntentionally = () => {
    const audio = audioRef.current;
    if (!audio || audio.paused) {
      suppressPauseRecovery.current = false;
      return;
    }
    suppressPauseRecovery.current = true;
    audio.pause();
    window.setTimeout(() => { suppressPauseRecovery.current = false; }, 0);
  };

  const schedulePlaybackRecovery = (reason: string) => {
    if (!shouldBePlaying.current || seekingRef.current || !currentSrc || recoveryTimer.current !== null) return;
    if (recoveryAttempts.current >= MAX_RECOVERY_ATTEMPTS) {
      shouldBePlaying.current = false;
      setIsPlaying(false);
      setIsBuffering(false);
      captureTrackEvent("playback_recovery_failed", {
        reason,
        attempts: recoveryAttempts.current,
        position_seconds: Math.floor(progressRef.current),
      });
      return;
    }

    setIsBuffering(true);
    const delay = Math.min(STALL_RECOVERY_DELAY_MS * 2 ** recoveryAttempts.current, 12000);
    recoveryTimer.current = window.setTimeout(() => {
      recoveryTimer.current = null;
      if (!shouldBePlaying.current || seekingRef.current) return;
      const position = audioRef.current?.currentTime || progressRef.current;
      recoveryPosition.current = position;
      recoveryReason.current = reason;
      recoveryAttempts.current += 1;
      captureTrackEvent("playback_recovery_attempted", {
        reason,
        attempt: recoveryAttempts.current,
        position_seconds: Math.floor(position),
      });
      setStreamAttempt((value) => value + 1);
    }, delay);
  };
  useEffect(() => {
    scheduleRecoveryRef.current = schedulePlaybackRecovery;
  });

  useEffect(() => {
    const updateTime = () => setDeviceTime(formatDeviceTime());
    updateTime();
    const clock = window.setInterval(updateTime, 15000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    clearRecoveryTimer();
    recoveryPosition.current = null;
    recoveryReason.current = null;
    recoveryAttempts.current = 0;
    lastProgressAt.current = playbackClock();
    return clearRecoveryTimer;
  }, [trackId]);

  useEffect(() => {
    if (!currentSrc) return;
    const checkPlayback = () => {
      const audio = audioRef.current;
      if (!audio || !shouldBePlaying.current || seekingRef.current || audio.ended) return;
      if (audio.paused) scheduleRecoveryRef.current("unexpected_pause");
      else if (playbackClock() - lastProgressAt.current > 12000) scheduleRecoveryRef.current("watchdog_timeout");
    };
    const resumeWhenVisible = () => {
      if (document.visibilityState === "visible") checkPlayback();
    };
    const watchdog = window.setInterval(checkPlayback, 5000);
    document.addEventListener("visibilitychange", resumeWhenVisible);
    return () => {
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", resumeWhenVisible);
    };
  }, [currentSrc, trackId]);

  useEffect(() => {
    fetch("/api/access/register", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => undefined);

    fetch("/api/media")
      .then((response) => response.json() as Promise<{ assets?: MediaAsset[] }>)
      .then(({ assets = [] }) => {
        setUploadedSources(Object.fromEntries(assets.map((asset) => [asset.trackId, asset.url])));
        captureAnalytics("archive_loaded", { available_sessions: assets.length, total_sessions: 36 });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const state = JSON.parse(raw) as { trackId?: string; progress?: Record<string, number>; favorites?: string[] };
          const fallbackId = ALBUMS[0].tracks[0].id;
          const restoredId = state.trackId && findTrack(state.trackId).track.id === state.trackId ? state.trackId : fallbackId;
          savedProgress.current = state.progress ?? {};
          setTrackId(restoredId);
          setProgress(savedProgress.current[restoredId] ?? 0);
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
      favorites,
    }));
  }, [favorites, isPlaying, progress, ready, trackId]);

  useEffect(() => {
    if (!isPlaying || currentSrc) return;
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
  }, [currentSrc, duration, isPlaying]);

  const setDiscAngle = (angle: number) => {
    discRotation.current = angle;
    discRef.current?.style.setProperty("--disc-angle", `${angle}deg`);
  };

  useEffect(() => {
    if (!isPlaying || isSeeking || isBuffering) return;
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
  }, [isBuffering, isPlaying, isSeeking]);

  useEffect(() => () => {
    const context = scratchAudio.current?.context;
    scratchAudio.current = null;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const prepareScratchAudio = () => {
    if (!scratchAudio.current) {
      const AudioContextClass = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      const context = new AudioContextClass();
      const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.14), context.sampleRate);
      const samples = noise.getChannelData(0);
      let previous = 0;
      let noiseSeed = 0x51f15e;
      for (let index = 0; index < samples.length; index += 1) {
        noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
        const white = noiseSeed / 0xffffffff * 2 - 1;
        previous = white * 0.72 + previous * 0.28;
        const envelope = Math.sin(Math.PI * index / samples.length);
        samples[index] = previous * envelope;
      }
      scratchAudio.current = { context, noise, lastBurstAt: 0 };
    }
    if (scratchAudio.current.context.state === "suspended") {
      void scratchAudio.current.context.resume();
    }
    return scratchAudio.current;
  };

  const emitScratch = (delta: number, elapsed: number) => {
    if (Math.abs(delta) < 0.25) return;
    const scratch = prepareScratchAudio();
    if (!scratch || scratch.context.state !== "running") return;
    const now = scratch.context.currentTime;
    if (now - scratch.lastBurstAt < 0.026) return;
    scratch.lastBurstAt = now;

    const speed = Math.min(1, Math.abs(delta) / Math.max(elapsed, 8) / 0.7);
    const duration = 0.045 + speed * 0.055;
    const source = scratch.context.createBufferSource();
    const filter = scratch.context.createBiquadFilter();
    const gain = scratch.context.createGain();
    source.buffer = scratch.noise;
    source.playbackRate.value = delta < 0 ? 0.72 + speed * 0.38 : 0.95 + speed * 0.72;
    filter.type = "bandpass";
    filter.frequency.value = 620 + speed * 1700;
    filter.Q.value = 0.7 + speed * 0.9;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.018 + speed * 0.035, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(scratch.context.destination);
    source.addEventListener("ended", () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    }, { once: true });
    source.start(now);
    source.stop(now + duration);

    const hapticNow = playbackClock();
    const hapticInterval = 70 - speed * 34;
    if (hapticNow - lastScrubHapticAt.current >= hapticInterval && "vibrate" in navigator) {
      lastScrubHapticAt.current = hapticNow;
      navigator.vibrate(speed > 0.65 ? 7 : 4);
    }
  };

  const selectTrack = (nextId: string, continuePlaying = false) => {
    captureTrackEvent("session_selected", { playback_requested: continuePlaying, started_from_beginning: true }, nextId);
    resetRecovery();
    shouldBePlaying.current = continuePlaying;
    seekingRef.current = false;
    savedProgress.current[trackId] = progress;
    savedProgress.current[nextId] = 0;
    setIsPlaying(continuePlaying);
    pauseIntentionally();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setStreamAttempt(0);
    setTrackId(nextId);
    setMediaDuration(0);
    setProgress(0);
    setOpenAlbumId(findTrack(nextId).album.id);
    setLibraryOpen(false);
    setShowMiniPlayer(true);
    setDiscAngle(0);
    if (continuePlaying && !uploadedSources[nextId] && !findTrack(nextId).track.src) {
      captureTrackEvent("playback_started", { position_seconds: 0, media_available: false }, nextId);
    }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      shouldBePlaying.current = false;
      resetRecovery();
      pauseIntentionally();
      setIsPlaying(false);
      captureTrackEvent("playback_paused", { position_seconds: Math.floor(progress) });
      return;
    }
    setShowMiniPlayer(true);
    shouldBePlaying.current = true;
    setIsPlaying(true);
    lastProgressAt.current = playbackClock();
    if (currentSrc && audioRef.current) {
      try {
        audioRef.current.currentTime = progress;
        await audioRef.current.play();
      } catch {
        shouldBePlaying.current = false;
        setIsPlaying(false);
        captureTrackEvent("playback_error", { reason: "play_rejected", position_seconds: Math.floor(progress) });
        return;
      }
    }
    if (!currentSrc) captureTrackEvent("playback_started", { position_seconds: Math.floor(progress), media_available: false });
  };

  const seek = (value: number) => {
    setProgress(value);
    if (isSeeking) {
      const fractionMoved = (value - rangeSeekStart.current.progress) / Math.max(duration, 1);
      setDiscAngle(rangeSeekStart.current.rotation + fractionMoved * 1080);
    }
    if (audioRef.current && currentSrc) audioRef.current.currentTime = value;
  };

  const skipSeconds = (amount: number) => {
    const currentTime = audioRef.current?.currentTime ?? progress;
    const next = Math.max(0, Math.min(duration, currentTime + amount));
    setProgress(next);
    if (audioRef.current && currentSrc) audioRef.current.currentTime = next;
    captureTrackEvent("playback_skipped", {
      skip_seconds: amount,
      from_seconds: Math.floor(currentTime),
      to_seconds: Math.floor(next),
    });
    if ("vibrate" in navigator) navigator.vibrate(7);
  };

  const beginSeeking = (method: "rail" | "disc") => {
    seekMethod.current = method;
    seekWasPlaying.current = isPlaying;
    seekingRef.current = true;
    clearRecoveryTimer();
    rangeSeekStart.current = { progress, rotation: discRotation.current };
    pauseIntentionally();
    setIsPlaying(false);
    setIsSeeking(true);
    if ("vibrate" in navigator) navigator.vibrate(7);
  };

  const endSeeking = () => {
    seekingRef.current = false;
    setIsSeeking(false);
    captureTrackEvent("playback_seeked", {
      method: seekMethod.current,
      from_seconds: Math.floor(rangeSeekStart.current.progress),
      to_seconds: Math.floor(progress),
    });
    if (!seekWasPlaying.current) return;
    seekWasPlaying.current = false;
    shouldBePlaying.current = true;
    setIsPlaying(true);
    lastProgressAt.current = playbackClock();
    if (currentSrc && audioRef.current) {
      void audioRef.current.play().catch(() => schedulePlaybackRecovery("seek_resume_failed"));
    }
  };

  const pointerAngle = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2)) * 180 / Math.PI;
  };

  const beginDiscScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    prepareScratchAudio();
    beginSeeking("disc");
    discScrub.current = { pointerId: event.pointerId, lastAngle: pointerAngle(event), lastMovedAt: playbackClock() };
  };

  const moveDiscScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!discScrub.current || discScrub.current.pointerId !== event.pointerId) return;
    const angle = pointerAngle(event);
    let delta = angle - discScrub.current.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const movedAt = playbackClock();
    const elapsed = movedAt - discScrub.current.lastMovedAt;
    discScrub.current.lastAngle = angle;
    discScrub.current.lastMovedAt = movedAt;
    emitScratch(delta, elapsed);
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
    if ("vibrate" in navigator) navigator.vibrate(0);
    endSeeking();
  };

  const share = async () => {
    try {
      const data = { title: `${current.track.title} — Gateway Tapes`, url: window.location.href };
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      captureTrackEvent("session_shared", { share_method: navigator.share ? "system" : "clipboard" });
      window.setTimeout(() => setShared(false), 1600);
    } catch { setShared(false); }
  };

  const toggleFavorite = () => {
    const willBeFavorite = !favorite;
    setFavorites((items) => items.includes(trackId) ? items.filter((id) => id !== trackId) : [...items, trackId]);
    captureTrackEvent("favorite_toggled", { favorite: willBeFavorite });
  };

  const openLibrary = () => {
    setLibraryOpen(true);
    captureAnalytics("library_opened", { from_session_id: trackId });
  };

  const openManual = (album: Album) => {
    setManualWaveId(album.id);
    captureAnalytics("manual_opened", {
      wave_id: album.id,
      wave_number: album.roman,
      wave_title: album.title,
      manual_pages: album.manualPages,
    });
  };

  const recordDownload = () => {
    captureTrackEvent("recording_download_started", {
      file_type: "flac",
      source: "player_action",
    });
  };

  const recordPlaying = () => {
    const recoveredAttempts = recoveryAttempts.current;
    const recoveredReason = recoveryReason.current;
    clearRecoveryTimer();
    recoveryPosition.current = null;
    recoveryReason.current = null;
    recoveryAttempts.current = 0;
    shouldBePlaying.current = true;
    lastProgressAt.current = playbackClock();
    setIsBuffering(false);
    setIsPlaying(true);
    if (recoveredAttempts > 0) {
      captureTrackEvent("playback_recovery_succeeded", {
        reason: recoveredReason,
        attempts: recoveredAttempts,
        position_seconds: Math.floor(audioRef.current?.currentTime ?? progressRef.current),
      });
    }
    const now = Date.now();
    if (lastPlayingCapture.current.trackId === trackId && now - lastPlayingCapture.current.at < 3000) return;
    lastPlayingCapture.current = { trackId, at: now };
    captureTrackEvent("playback_started", { position_seconds: Math.floor(audioRef.current?.currentTime ?? progress), media_available: true });
  };

  const recordBuffering = (reason: "waiting" | "stalled") => {
    setIsBuffering(true);
    schedulePlaybackRecovery(reason);
    const now = Date.now();
    if (now - lastBufferingCapture.current < 10000) return;
    lastBufferingCapture.current = now;
    captureTrackEvent("playback_buffering", { reason, position_seconds: Math.floor(audioRef.current?.currentTime ?? progress) });
  };

  const recordUnexpectedPause = () => {
    if (suppressPauseRecovery.current) {
      suppressPauseRecovery.current = false;
      return;
    }
    if (shouldBePlaying.current && !seekingRef.current && !audioRef.current?.ended) {
      schedulePlaybackRecovery("unexpected_pause");
    }
  };

  const recordStyle = { "--record": current.album.color } as CSSProperties;
  const discStyle = { "--disc-angle": "0deg" } as CSSProperties;

  return (
    <main className="gateway-shell" style={recordStyle}>
      <section className="phone" aria-label="Gateway Tapes audio player">
        <div className="screen">
          <audio
            ref={audioRef}
            src={playbackSrc}
            preload="auto"
            playsInline
            onLoadStart={() => setIsBuffering(shouldBePlaying.current)}
            onWaiting={() => recordBuffering("waiting")}
            onStalled={() => recordBuffering("stalled")}
            onLoadedMetadata={(event) => {
              setMediaDuration(event.currentTarget.duration);
              if (recoveryPosition.current !== null) {
                try { event.currentTarget.currentTime = recoveryPosition.current; } catch { /* wait for canplay */ }
              }
            }}
            onTimeUpdate={(event) => {
              const next = event.currentTarget.currentTime;
              progressRef.current = next;
              lastProgressAt.current = playbackClock();
              setProgress(next);
            }}
            onCanPlay={(event) => {
              setIsBuffering(false);
              if (recoveryPosition.current !== null) {
                try { event.currentTarget.currentTime = recoveryPosition.current; } catch { /* retry after reload */ }
              }
              if (shouldBePlaying.current) {
                void event.currentTarget.play().catch(() => schedulePlaybackRecovery("canplay_resume_failed"));
              }
            }}
            onPlaying={recordPlaying}
            onPause={recordUnexpectedPause}
            onError={() => {
              captureTrackEvent("playback_error", {
                reason: "media_error",
                media_error_code: audioRef.current?.error?.code,
                position_seconds: Math.floor(progressRef.current),
              });
              if (shouldBePlaying.current) schedulePlaybackRecovery("media_error");
              else setIsBuffering(false);
            }}
            onEnded={() => {
              shouldBePlaying.current = false;
              resetRecovery();
              captureTrackEvent("playback_completed");
              setIsPlaying(false);
            }}
          />

          <div className="status-bar" aria-hidden="true">
            <span suppressHydrationWarning>{deviceTime}</span>
            <span className="status-icons"><SignalHigh /><Wifi /><BatteryMedium /></span>
          </div>
          <div className="island" aria-hidden="true"><span></span></div>

          <header className="player-header">
            <button className="icon-button" aria-label="Open albums" onClick={openLibrary}><ArrowLeft /></button>
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
              onPointerDown={(event) => { beginSeeking("rail"); event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerUp={endSeeking}
              onPointerCancel={endSeeking}
              onBlur={() => { if (isSeeking) endSeeking(); }}
              onChange={(event) => seek(Number(event.target.value))}
            />
            <div className="times"><span>{formatTime(progress)}</span><span>−{formatTime(duration - progress)}</span></div>
          </section>

          <nav className="transport" aria-label="Transport controls">
            <button aria-label="Rewind 10 seconds" onClick={() => skipSeconds(-10)} className="transport-icon skip-seconds"><TenSecondIcon direction="back" /></button>
            <button aria-label={isBuffering ? "Buffering" : isPlaying ? "Pause" : "Play"} aria-pressed={isPlaying} onClick={togglePlayback} className="play-pause">
              {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
            </button>
            <button aria-label="Fast-forward 10 seconds" onClick={() => skipSeconds(10)} className="transport-icon skip-seconds"><TenSecondIcon direction="forward" /></button>
          </nav>

          <div className="bottom-actions">
            <button className="action-icon" aria-label="Open library" onClick={openLibrary}><ListMusic /></button>
            <button className="action-icon" aria-label={`Open Wave ${current.album.roman} manual`} onClick={() => openManual(current.album)}><BookOpenText /></button>
            <a
              className="action-icon"
              aria-label={`Download ${current.track.title} as FLAC`}
              href={`/api/audio/${trackId}?download=1`}
              download={`${trackId}.flac`}
              onClick={recordDownload}
            ><Download /></a>
          </div>

          {libraryOpen && (
            <section className="library-panel" aria-label="Gateway Tapes library">
              <header>
                <div><b>GATEWAY TAPES</b><span>06 WAVES · 36 SESSIONS</span></div>
                <button className="library-manual" aria-label={`Open Wave ${openAlbum.roman} manual`} onClick={() => openManual(openAlbum)}><BookOpenText /><span>MANUAL {openAlbum.roman}</span></button>
              </header>
              <div className="album-grid">
                {ALBUMS.map((album) => (
                  <button key={album.id} className={`album-card ${openAlbumId === album.id ? "selected" : ""}`} onClick={() => {
                    setOpenAlbumId(album.id);
                    captureAnalytics("wave_selected", { wave_id: album.id, wave_number: album.roman, wave_title: album.title });
                  }}>
                    <span className="album-art" style={{ background: album.color }}><i></i><b>{album.roman}</b></span>
                    <span>WAVE {album.roman}</span><strong>{album.title}</strong>
                  </button>
                ))}
              </div>
              <div className="track-list">
                <h2>Wave {openAlbum.roman} — {openAlbum.title}</h2>
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
