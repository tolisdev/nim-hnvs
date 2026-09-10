import React, { useEffect, useRef, useMemo, useState } from 'react';
import YouTube from 'react-youtube';
import type { YouTubeProps, YouTubePlayer } from 'react-youtube';
import { Play, Pause, RotateCcw, FastForward, Gauge } from 'lucide-react';

interface VideoPlayerProps {
  youtubeId: string;
  onTimeUpdate: (seconds: number) => void;
  seekToSeconds: number | null;
  onSeekComplete: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  youtubeId,
  onTimeUpdate,
  seekToSeconds,
  onSeekComplete
}) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<any>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isPlayerReady, setIsPlayerReady] = useState<boolean>(false);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const cleanId = useMemo(() => {
    let id = (youtubeId || '').trim();
    if (id.includes('watch?v=')) {
      id = id.split('watch?v=')[1].split('&')[0];
    } else if (id.includes('youtu.be/')) {
      id = id.split('youtu.be/')[1].split('?')[0];
    }
    return id;
  }, [youtubeId]);

  // Handle seeking when triggered externally
  useEffect(() => {
    if (seekToSeconds !== null && playerRef.current) {
      playerRef.current.seekTo(seekToSeconds, true);
      playerRef.current.playVideo();
      setIsPlaying(true);
      onSeekComplete();
    }
  }, [seekToSeconds, onSeekComplete]);

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    const playerState = playerRef.current.getPlayerState?.();
    if (playerState === 1) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    if (!playerRef.current) return;
    const current = playerRef.current.getCurrentTime?.() || 0;
    const newTime = Math.max(0, current + deltaSeconds);
    playerRef.current.seekTo(newTime, true);
    onTimeUpdateRef.current(Math.floor(newTime));
  };

  // Keyboard shortcut listener for space / seek
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Don't intercept if student is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (!playerRef.current) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key === 'j' || e.key === 'J') {
        seekRelative(-10);
      } else if (e.key === 'l' || e.key === 'L') {
        seekRelative(10);
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  const handleRateChange = (rate: number) => {
    if (!playerRef.current) return;
    playerRef.current.setPlaybackRate?.(rate);
    setPlaybackRate(rate);
  };

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    setIsPlayerReady(true);
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        if (typeof time === 'number') {
          onTimeUpdateRef.current(Math.floor(time));
        }
      }
    }, 500);
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    // 1: playing, 2: paused
    if (event.data === 1) {
      setIsPlaying(true);
    } else if (event.data === 2) {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      rel: 0,
      modestbranding: 1
    }
  };

  const speedOptions = [1, 1.25, 1.5, 1.75, 2];

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Video Viewport */}
      <div className="relative w-full flex-1 min-h-[380px] bg-black flex items-center justify-center">
        {!isPlayerReady && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-500 z-10 font-mono text-xs">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
            <span>Φόρτωση YouTube player ({cleanId})...</span>
          </div>
        )}
        <YouTube
          videoId={cleanId}
          opts={opts}
          onReady={onPlayerReady}
          onStateChange={onPlayerStateChange}
          className="absolute inset-0 w-full h-full"
          iframeClassName="w-full h-full border-0"
        />
      </div>

      {/* Student Study Control Bar */}
      <div className="p-2.5 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-300">
        {/* Left: Quick Seek & Play Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={togglePlayPause}
            className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-sm flex items-center justify-center"
            title={isPlaying ? 'Παύση (Space)' : 'Αναπαραγωγή (Space)'}
            aria-label={isPlaying ? 'Παύση' : 'Αναπαραγωγή'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={() => seekRelative(-5)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Πίσω 5 δευτερόλεπτα (←)"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="font-mono text-[11px]">-5s</span>
          </button>

          <button
            onClick={() => seekRelative(5)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Εμπρός 5 δευτερόλεπτα (→)"
          >
            <FastForward className="w-3 h-3" />
            <span className="font-mono text-[11px]">+5s</span>
          </button>
        </div>

        {/* Center: Video Info Badge */}
        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>YouTube ID: {cleanId}</span>
        </div>

        {/* Right: Study Speed Selector */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <Gauge className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden md:inline">
            Ταχύτητα:
          </span>
          {speedOptions.map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-bold transition cursor-pointer ${
                playbackRate === rate
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

