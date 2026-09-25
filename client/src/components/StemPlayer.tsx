import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Mic, Disc3, Music2, Sparkles } from 'lucide-react';
import { JobInfo } from '../types';

interface StemPlayerProps {
  job: JobInfo;
}

type ActiveStem = 'instrumental' | 'vocals' | 'original';

export const StemPlayer: React.FC<StemPlayerProps> = ({ job }) => {
  const [activeStem, setActiveStem] = useState<ActiveStem>('instrumental');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(job.duration || 0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedBitrate, setSelectedBitrate] = useState<number>(320);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio source URL
  const getStemUrl = (stem: ActiveStem) => {
    return `/api/media/${job.id}/${stem}`;
  };

  // Sync playback across stems
  const handleStemChange = (newStem: ActiveStem) => {
    const wasPlaying = isPlaying;
    const prevTime = audioRef.current ? audioRef.current.currentTime : currentTime;
    setActiveStem(newStem);

    // After state updates and audio src changes, maintain time position
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = prevTime;
        if (wasPlaying) {
          audioRef.current.play().catch(() => {});
        }
      }
    }, 50);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      setIsMuted(newVol === 0);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl glass-panel p-5 sm:p-6 shadow-sm border border-neutral-200/80 dark:border-neutral-800/80 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/60 dark:border-neutral-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Vocal & Instrumental Audio Separation
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
              {job.separationMethod || 'DSP Separation'}
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Isolated instrumental track is analyzed for background music recognition.
          </p>
        </div>

        {/* Download stem button */}
        <div className="flex items-center gap-2">
          <select
            value={selectedBitrate}
            onChange={(e) => setSelectedBitrate(parseInt(e.target.value, 10))}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={320}>320 kbps (HQ)</option>
            <option value={256}>256 kbps</option>
            <option value={192}>192 kbps</option>
            <option value={128}>128 kbps</option>
          </select>
          <a
            href={`/api/download/stem/${job.id}/${activeStem}?bitrate=${selectedBitrate}`}
            download
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {activeStem === 'instrumental' ? 'Music' : activeStem === 'vocals' ? 'Vocals' : 'Audio'} MP3</span>
          </a>
        </div>
      </div>

      {/* Stem Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Instrumental Track (Primary) */}
        <button
          type="button"
          onClick={() => handleStemChange('instrumental')}
          className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
            activeStem === 'instrumental'
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500/30'
              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              activeStem === 'instrumental'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}>
              <Disc3 className={`w-5 h-5 ${isPlaying && activeStem === 'instrumental' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                  Instrumental Track
                </span>
              </div>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> Primary Output
              </span>
            </div>
          </div>
        </button>

        {/* Isolated Vocals */}
        <button
          type="button"
          onClick={() => handleStemChange('vocals')}
          className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
            activeStem === 'vocals'
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500/30'
              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              activeStem === 'vocals'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}>
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                Isolated Vocals
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Speech / Voice Filtered
              </span>
            </div>
          </div>
        </button>

        {/* Original Mix */}
        <button
          type="button"
          onClick={() => handleStemChange('original')}
          className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
            activeStem === 'original'
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500/30'
              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              activeStem === 'original'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}>
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                Original Audio
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Full Mixed Track
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Audio Element & Controls Bar */}
      <div className="bg-neutral-50 dark:bg-neutral-900/60 rounded-xl p-4 border border-neutral-200/50 dark:border-neutral-800/60 space-y-3">
        <audio
          ref={audioRef}
          src={getStemUrl(activeStem)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
        />

        {/* Scrubber Slider */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls & Volume */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 transition-transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Playing: <span className="capitalize font-semibold text-indigo-600 dark:text-indigo-400">{activeStem}</span>
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 sm:w-24 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
