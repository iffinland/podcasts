interface EpisodeThumbnailProps {
  src: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

const EpisodeThumbnail = ({ src, alt, size = 'md' }: EpisodeThumbnailProps) => {
  if (!src) {
    return (
      <div className={`episode-thumb episode-thumb--${size}`}>
        Qortal-Podcasts
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`episode-thumb episode-thumb--${size}`}
    />
  );
};

export default EpisodeThumbnail;
