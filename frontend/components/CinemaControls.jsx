import React from 'react';
import '../src/netflix-movie.css';

/**
 * Controles premium estilo Netflix
 */
const CinemaControls = ({
    isPlaying,
    onPlayPause,
    onPrevious,
    onNext,
    onFullscreen,
    currentScene = 0,
    totalScenes = 0,
    compact = false
}) => {
    return (
        <div className={`cinema-controls glass-effect ${compact ? 'compact-mode' : ''}`}>
            {/* Playback controls */}
            <div className="playback-group">
                <button
                    className="control-btn"
                    onClick={onPrevious}
                    aria-label="Escena anterior"
                >
                    ⏮
                </button>

                <button
                    className="control-btn-primary glow-effect"
                    onClick={onPlayPause}
                    aria-label={isPlaying ? "Pausar" : "Reproducir"}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>

                <button
                    className="control-btn"
                    onClick={onNext}
                    aria-label="Escena siguiente"
                >
                    ⏭
                </button>
            </div>

            {/* Scene info (Hidden in compact mode as it's shown elsewhere) */}
            {!compact && (
                <div className="scene-info">
                    <span className="scene-counter">
                        {currentScene + 1} / {totalScenes}
                    </span>
                </div>
            )}

            {/* Right controls */}
            <div className="extra-controls">
                <button
                    className="control-btn"
                    onClick={onFullscreen}
                    aria-label="Pantalla completa"
                >
                    🖵
                </button>
            </div>
        </div>
    );
};

export default CinemaControls;
