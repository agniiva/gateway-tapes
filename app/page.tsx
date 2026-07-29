"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DURATION = 548;
const START_AT = 187;
const TICKS = Array.from({ length: 72 }, (_, index) =>
  3 + ((index * 7 + index * index) % 8),
);

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(START_AT);
  const [volume, setVolume] = useState(0.55);
  const [showVolume, setShowVolume] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const masterGain = useRef<GainNode | null>(null);
  const phraseTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const noteIndex = useRef(0);

  const playNote = useCallback(() => {
    const context = audioContext.current;
    const master = masterGain.current;
    if (!context || !master || context.state !== "running") return;

    const notes = [146.83, 174.61, 196, 220, 196, 174.61, 164.81, 146.83];
    const now = context.currentTime;
    const root = notes[noteIndex.current % notes.length];
    noteIndex.current += 1;

    [root, root * 1.5].forEach((frequency, voice) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = voice === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(voice === 0 ? 0.16 : 0.045, now + 0.025);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.38);
    });
  }, []);

  const ensureAudio = useCallback(async () => {
    if (!audioContext.current) {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.value = volume;
      gain.connect(context.destination);
      audioContext.current = context;
      masterGain.current = gain;
    }
    await audioContext.current.resume();
  }, [volume]);

  const togglePlayback = useCallback(async () => {
    if (!isPlaying) {
      await ensureAudio();
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [ensureAudio, isPlaying]);

  useEffect(() => {
    if (masterGain.current && audioContext.current) {
      masterGain.current.gain.setTargetAtTime(volume, audioContext.current.currentTime, 0.03);
    }
  }, [volume]);

  useEffect(() => {
    if (!isPlaying) {
      if (phraseTimer.current) clearInterval(phraseTimer.current);
      phraseTimer.current = null;
      audioContext.current?.suspend();
      return;
    }

    playNote();
    phraseTimer.current = setInterval(playNote, 470);
    const clock = setInterval(() => {
      setProgress((current) => {
        if (current >= DURATION) {
          setIsPlaying(false);
          return 0;
        }
        return Math.min(DURATION, current + 0.25);
      });
    }, 250);

    return () => {
      if (phraseTimer.current) clearInterval(phraseTimer.current);
      phraseTimer.current = null;
      clearInterval(clock);
    };
  }, [isPlaying, playNote]);

  useEffect(() => {
    return () => {
      if (phraseTimer.current) clearInterval(phraseTimer.current);
      audioContext.current?.close();
    };
  }, []);

  const share = async () => {
    const payload = { title: "So What — Miles Davis", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(payload);
      else await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      setShared(false);
    }
  };

  const percentage = (progress / DURATION) * 100;

  return (
    <main className="poster">
      <div className="corner-label">Info</div>
      <div className="byline">by Ilias B [ designfox ]</div>

      <section className="phone" aria-label="Interactive Swiss audio player">
        <div className="screen">
          <div className="status-bar" aria-hidden="true">
            <span>9:41</span>
            <span className="status-icons"><i></i><i></i><b></b></span>
          </div>
          <div className="island" aria-hidden="true"><span></span></div>

          <header className="player-header">
            <button className="icon-button back" aria-label="Restart track" onClick={() => setProgress(0)}>
              <span></span>
            </button>
            <span className="album-label">Miles Davis — Kind of Blue</span>
            <button className="icon-button share" aria-label={shared ? "Link copied" : "Share track"} onClick={share}>
              <span></span><span></span><span></span>
            </button>
          </header>

          <div className={`disc ${isPlaying ? "is-playing" : ""}`} aria-label={isPlaying ? "Record spinning" : "Record paused"}>
            <span className="disc-mark mark-one"></span>
            <span className="disc-hole"></span>
            <span className="disc-mark mark-two"></span>
          </div>

          <section className="track-block">
            <div className="track-heading">
              <div>
                <h1>So What</h1>
                <p>Miles Davis</p>
              </div>
              <button className={`favorite ${favorite ? "active" : ""}`} aria-label={favorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={favorite} onClick={() => setFavorite((value) => !value)}>
                <span>★</span>
              </button>
            </div>
            <p className="credits">with Julian “Cannonball” Adderley, Paul Chambers,<br />James Cobb, Bill Evans, John Coltrane, Wynton Kelly</p>
          </section>

          <section className="seek-block" aria-label="Playback position">
            <div className="ticks" aria-hidden="true">
              {TICKS.map((height, index) => (
                <i key={index} className={index / TICKS.length <= percentage / 100 ? "elapsed" : ""} style={{ height }}></i>
              ))}
            </div>
            <input aria-label="Seek through track" type="range" min="0" max={DURATION} step="1" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
            <div className="times"><span>{formatTime(progress)}</span><span>−{formatTime(DURATION - progress)}</span></div>
          </section>

          <nav className="transport" aria-label="Transport controls">
            <button aria-label="Back 15 seconds" onClick={() => setProgress((value) => Math.max(0, value - 15))} className="skip previous"><i></i><i></i><b></b></button>
            <button aria-label={isPlaying ? "Pause" : "Play"} aria-pressed={isPlaying} onClick={togglePlayback} className="play-pause">
              {isPlaying ? <span className="pause-symbol"><i></i><i></i></span> : <span className="play-symbol"></span>}
            </button>
            <button aria-label="Forward 15 seconds" onClick={() => setProgress((value) => Math.min(DURATION, value + 15))} className="skip next"><i></i><i></i><b></b></button>
          </nav>

          <div className="bottom-actions">
            <button className={`queue-button ${queueOpen ? "active" : ""}`} aria-label="Toggle queue" aria-pressed={queueOpen} onClick={() => setQueueOpen((value) => !value)}><i></i><i></i><i></i><b></b><b></b><b></b></button>
            <button className="volume-button" aria-label="Toggle volume control" aria-expanded={showVolume} onClick={() => setShowVolume((value) => !value)}><i></i><b></b><em></em></button>
          </div>

          {queueOpen && <div className="queue-panel" role="status"><b>UP NEXT</b><span>Freddie Freeloader · 09:46</span></div>}
          {showVolume && (
            <div className="volume-panel">
              <label htmlFor="volume">VOL</label>
              <input id="volume" aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
              <span>{Math.round(volume * 100)}</span>
            </div>
          )}
        </div>
      </section>

      <section className="editorial">
        <div className="intro-copy">
          <h2>Swiss Audio Player</h2>
          <p>No AI, no gradients, no roundings,<br />no shadows, no glass, no backgrounds,<br />no overdesign</p>
        </div>
        <div className="manifesto">
          <p>A strict Swiss International Style take<br />on a music player. Grid-first layout,<br />left-aligned type, high contrast.</p>
          <p>Pure minimalism. Bold as the classics.</p>
        </div>
      </section>

      <div className="year">2025</div>
      <div className="signature">press L</div>
    </main>
  );
}
