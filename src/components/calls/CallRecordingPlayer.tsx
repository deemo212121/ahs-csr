'use client';

import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

export function CallRecordingPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function applyDuration() {
      // Recordings made from MediaRecorder before the duration fix (or any
      // file the browser otherwise can't size upfront) report duration as
      // Infinity/NaN — the progress bar would then be driven by whatever
      // partial estimate the browser guesses instead of the real length.
      // Seeking to a huge offset forces Chromium/Firefox to scan the whole
      // file and resolve the actual duration; snap back to where the
      // listener actually was afterward.
      if (!audio) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        return;
      }
      const resumeAt = audio.currentTime;
      audio.currentTime = 1e9;
      const onFixed = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
        audio.currentTime = resumeAt;
        audio.removeEventListener('timeupdate', onFixed);
      };
      audio.addEventListener('timeupdate', onFixed);
    }

    function onTimeUpdate() {
      if (!seeking && audio) setCurrentTime(audio.currentTime);
    }
    function onPlay() {
      setPlaying(true);
    }
    function onPause() {
      setPlaying(false);
    }
    function onEnded() {
      setPlaying(false);
      setCurrentTime(audio?.duration ?? 0);
    }

    audio.addEventListener('loadedmetadata', applyDuration);
    audio.addEventListener('durationchange', applyDuration);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', applyDuration);
      audio.removeEventListener('durationchange', applyDuration);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src, seeking]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    setCurrentTime(value);
    if (audio) audio.currentTime = value;
  }

  const progressMax = duration > 0 ? duration : 1;

  return (
    <div className="call-recording-player">
      <audio ref={audioRef} preload="metadata" src={src} />
      <button aria-label={playing ? 'Pause' : 'Play'} className="call-recording-play-btn" onClick={togglePlay} type="button">
        {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
      </button>
      <span className="call-recording-time">{formatTime(currentTime)}</span>
      <input
        aria-label="Seek recording"
        className="call-recording-seek"
        max={progressMax}
        min={0}
        onChange={(event) => seekTo(Number(event.target.value))}
        onMouseDown={() => setSeeking(true)}
        onMouseUp={() => setSeeking(false)}
        onTouchEnd={() => setSeeking(false)}
        onTouchStart={() => setSeeking(true)}
        step={0.01}
        type="range"
        value={Math.min(currentTime, progressMax)}
      />
      <span className="call-recording-time">{duration > 0 ? formatTime(duration) : '--:--'}</span>
    </div>
  );
}
