import React, { useEffect, useState } from 'react';
import '../src/netflix-movie.css';

/**
 * Hero Section cinematográfica estilo Netflix
 */
const NetflixHero = ({ title, subtitle, onPlay, stats = [] }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    return (
        <div
            className={`netflix-hero group cursor-pointer ${isVisible ? 'fade-in' : ''}`}
            onClick={onPlay}
        >
            {/* Background Gradient/Thumbnail Placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f0f0f] to-black">
                {/* Subtle grid pattern for data feel */}
                <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                </div>
            </div>

            {/* Title Overlay (Top Left like YouTube) */}
            <div className="absolute top-0 left-0 right-0 p-8 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-20">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg font-sans tracking-tight">
                    {title || 'Película de Datos'}
                </h1>
                <p className="text-lg text-slate-200 font-medium drop-shadow-md">
                    {subtitle || 'Descubre la historia detrás de tus datos'}
                </p>
            </div>

            {/* Center Play Button (YouTube Style) */}
            <div className="absolute inset-0 flex items-center justify-center z-30">
                <div className="yt-play-button group-hover:scale-110 transition-transform duration-300 ease-out">
                    <div className="yt-play-icon"></div>
                </div>
            </div>

            {/* Stats Overlay (Bottom, integrated like video metadata) */}
            {stats.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20 flex items-end justify-between">
                    <div className="flex gap-6">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="flex flex-col">
                                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">{stat.label}</span>
                                <span className="text-xl font-bold text-white">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="text-slate-400 text-sm font-medium bg-black/50 px-3 py-1 rounded-md border border-white/10">
                        Click para iniciar
                    </div>
                </div>
            )}
        </div>
    );
};

export default NetflixHero;
