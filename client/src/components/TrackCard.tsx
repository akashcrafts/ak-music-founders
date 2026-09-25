import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Music, 
  Disc, 
  Radio,
  Copy,
  Check
} from 'lucide-react';
import { TrackInfo } from '../types';

interface TrackCardProps {
  track: TrackInfo;
  index: number;
  totalTracks: number;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, index, totalTracks }) => {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [selectedBitrate, setSelectedBitrate] = useState<number>(320);
  const [copiedYt, setCopiedYt] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const togglePreview = () => {
    if (!audioRef.current) return;
    if (isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlayingPreview(true);
    }
  };

  // Safe fallback artwork
  const artwork = track.artwork_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80';

  // Construct YouTube URL for this track
  const youtubeUrl = track.source_url && track.source_url.includes('youtube')
    ? track.source_url
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(track.artist + ' ' + track.title + ' official audio')}`;

  const handleCopyYt = () => {
    navigator.clipboard.writeText(youtubeUrl);
    setCopiedYt(true);
    setTimeout(() => setCopiedYt(false), 2000);
  };

  return (
    <div className="rounded-2xl glass-panel p-5 sm:p-7 shadow-sm border border-neutral-200/80 dark:border-white/[0.1] space-y-6 transition-all duration-200 hover:shadow-md">
      {/* Top Banner if multiple tracks */}
      {totalTracks > 1 && (
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200/60 dark:border-white/[0.08] text-xs">
          <span className="font-mono font-semibold text-neutral-500 uppercase tracking-wider">
            Track #{index + 1} of {totalTracks}
          </span>
          <span className="px-2.5 py-0.5 rounded-full font-mono bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300">
            {formatSeconds(track.start_time)} → {formatSeconds(track.end_time)}
          </span>
        </div>
      )}

      {/* Main Track Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Album Artwork */}
        <div className="relative group shrink-0">
          <img
            src={artwork}
            alt={track.title}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shadow-md border border-neutral-200/60 dark:border-white/[0.1]"
          />
          {track.preview_audio_url && (
            <button
              onClick={togglePreview}
              className="absolute inset-0 bg-black/40 group-hover:bg-black/60 rounded-xl flex items-center justify-center text-white transition-colors"
              title="Preview Song Audio"
            >
              {isPlayingPreview ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>
          )}
          {track.preview_audio_url && (
            <audio
              ref={audioRef}
              src={track.preview_audio_url}
              onEnded={() => setIsPlayingPreview(false)}
            />
          )}
        </div>

        {/* Title, Artist, Album, Confidence */}
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#00f2fe]/10 text-[#00b4d8] dark:text-[#00f2fe] border border-[#00f2fe]/30 font-mono">
              🎵 Detected Song
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md font-mono ${
              track.confidence >= 90
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
            }`}>
              Confidence: {track.confidence}%
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white truncate">
            {track.title}
          </h3>

          <p className="text-sm sm:text-base font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
            <Music className="w-4 h-4 text-[#00f2fe]" />
            <span>{track.artist}</span>
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 pt-1">
            {track.album && (
              <span className="flex items-center gap-1">
                <Disc className="w-3.5 h-3.5" />
                {track.album}
              </span>
            )}
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5" />
              {formatSeconds(track.start_time)} – {formatSeconds(track.end_time)} ({track.duration_detected.toFixed(1)}s)
            </span>
          </div>
        </div>
      </div>

      {/* Source Discovery Card */}
      <div className={`p-4 rounded-xl border ${
        track.download_available
          ? 'bg-emerald-500/[0.04] border-emerald-500/30'
          : 'bg-neutral-50 dark:bg-white/[0.03] border-neutral-200 dark:border-white/[0.08]'
      }`}>
        {track.download_available ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Authorized Source Found</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span>Format: <strong className="text-neutral-700 dark:text-neutral-300">MP3</strong></span>
                <span>•</span>
                <span>Quality: <strong className="text-neutral-700 dark:text-neutral-300">320 kbps</strong></span>
                <span>•</span>
                {track.source_url && (
                  <a
                    href={track.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#00b4d8] dark:text-[#00f2fe] hover:underline"
                  >
                    <span>{track.source_name || 'View Source'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* License description */}
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              License: <span className="font-medium text-neutral-800 dark:text-neutral-200">{track.license_type || 'Creative Commons'}</span>. This track is authorized for download.
            </p>

            {/* Quality selector and Download MP3 action */}
            <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-emerald-500/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Select Bitrate:
                </span>
                <select
                  value={selectedBitrate}
                  onChange={(e) => setSelectedBitrate(parseInt(e.target.value, 10))}
                  className="text-xs py-1.5 px-2.5 rounded-lg border border-neutral-200 dark:border-white/[0.12] bg-white dark:bg-surface text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[#00f2fe]"
                >
                  <option value={320}>320 kbps (High Fidelity)</option>
                  <option value={256}>256 kbps</option>
                  <option value={192}>192 kbps</option>
                  <option value={128}>128 kbps</option>
                </select>
              </div>

              <a
                href={`/api/download/${track.id}?bitrate=${selectedBitrate}`}
                download
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-[#08080B] text-xs font-bold shadow-md shadow-[#00f2fe]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Download MP3 ({track.artist} - {track.title}.mp3)</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-neutral-700 dark:text-neutral-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">
                  Identified Track Details & Official Sources
                </p>
                <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Listen or discover this song across official streaming platforms:
                </p>
              </div>
            </div>

            {/* Official streaming links */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <a
                href={`https://open.spotify.com/search/${encodeURIComponent(track.artist + ' ' + track.title)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20 transition-colors"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Spotify</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <a
                href={`https://music.apple.com/us/search?term=${encodeURIComponent(track.artist + ' ' + track.title)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FA243C]/10 text-[#FA243C] hover:bg-[#FA243C]/20 transition-colors"
              >
                <Disc className="w-3.5 h-3.5" />
                <span>Apple Music</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <a
                href={youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* EXPLICIT REQUIREMENT: Below YouTube link, provide link in white box */}
        <div className="mt-3.5 p-3 rounded-xl bg-white border border-neutral-200 shadow-sm text-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold text-neutral-400 block tracking-wider">
                Direct YouTube Link
              </span>
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-neutral-800 hover:text-red-600 truncate block underline font-medium text-xs"
              >
                {youtubeUrl}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyYt}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium transition-colors text-xs"
              title="Copy YouTube Link"
            >
              {copiedYt ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              title="Open YouTube Link in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
