import { useEffect, useMemo, useState } from 'react';
import { useIdentity } from '../../identity/context/IdentityContext';
import EpisodeComposerModal from '../../podcasts/components/EpisodeComposerModal';
import FeaturedEpisodePanel from '../../podcasts/components/FeaturedEpisodePanel';
import PlaylistManagerModal from '../../podcasts/components/PlaylistManagerModal';
import PodcastCrudPanel from '../../podcasts/components/PodcastCrudPanel';
import RecentEpisodesPanel from '../../podcasts/components/RecentEpisodesPanel';
import { useEpisodeComposer } from '../../podcasts/context/EpisodeComposerContext';
import { toEpisodeKey } from '../../podcasts/hooks/podcastKeys';
import { usePodcastCrud } from '../../podcasts/hooks/usePodcastCrud';
import { usePodcastSocial } from '../../podcasts/hooks/usePodcastSocial';
import { PodcastEpisode } from '../../../types/podcast';
import '../styles/home-page.css';

const HomePage = () => {
  const { activeName } = useIdentity();
  const podcastCrud = usePodcastCrud();
  const social = usePodcastSocial(activeName);
  const composer = useEpisodeComposer();
  const [featuredEpisode, setFeaturedEpisode] = useState<PodcastEpisode | null>(null);
  const [featuredAudioUrl, setFeaturedAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!featuredEpisode && podcastCrud.episodes.length > 0) {
      setFeaturedEpisode(podcastCrud.episodes[0]);
    }
  }, [featuredEpisode, podcastCrud.episodes]);

  useEffect(() => {
    if (!featuredEpisode) {
      setFeaturedAudioUrl(null);
      return;
    }

    let cancelled = false;
    setFeaturedAudioUrl(null);

    void podcastCrud
      .resolveAudioUrl(featuredEpisode)
      .then((url) => {
        if (!cancelled) {
          setFeaturedAudioUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFeaturedAudioUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [featuredEpisode, podcastCrud.resolveAudioUrl]);

  const episodeIndex = useMemo(() => {
    return podcastCrud.episodes.reduce<Record<string, PodcastEpisode>>((accumulator, episode) => {
      accumulator[toEpisodeKey(episode)] = episode;
      return accumulator;
    }, {});
  }, [podcastCrud.episodes]);

  const handlePlayEpisode = async (episode: PodcastEpisode) => {
    setFeaturedEpisode(episode);
  };

  const handleToggleLike = async (episode: PodcastEpisode) => {
    await social.toggleLike(toEpisodeKey(episode));
  };

  return (
    <>
      <EpisodeComposerModal
        isOpen={composer.isOpen}
        mode={composer.mode}
        activeName={activeName}
        editingEpisode={composer.editingEpisode}
        isSaving={podcastCrud.isSaving}
        onClose={composer.close}
        onCreate={async (payload) => {
          const created = await podcastCrud.createEpisode(payload);
          await handlePlayEpisode(created);
        }}
        onEdit={async (payload) => {
          const updated = await podcastCrud.editEpisode(payload);
          await handlePlayEpisode(updated);
        }}
      />
      <PlaylistManagerModal
        isOpen={composer.isPlaylistOpen}
        onClose={composer.closePlaylists}
        activeName={activeName}
        featuredEpisode={featuredEpisode}
        playlists={social.playlists}
        isLoading={social.isLoading}
        error={social.error}
        onCreatePlaylist={social.createNewPlaylist}
        onAddEpisode={social.addEpisode}
        onRemoveEpisode={social.removeEpisode}
        episodeIndex={episodeIndex}
      />

      <section className="home-grid">
        <section className="surface home-grid__top">
          <FeaturedEpisodePanel
            episode={featuredEpisode}
            audioUrl={featuredAudioUrl}
            liked={featuredEpisode ? social.likedSet.has(toEpisodeKey(featuredEpisode)) : false}
            onToggleLike={handleToggleLike}
          />
        </section>

        <section className="surface home-grid__panel">
          <RecentEpisodesPanel episodes={podcastCrud.episodes} onPlayEpisode={handlePlayEpisode} />
        </section>

        <section className="surface home-grid__panel">
          <PodcastCrudPanel
            activeName={activeName}
            episodes={podcastCrud.episodes}
            isLoading={podcastCrud.isLoading}
            isSaving={podcastCrud.isSaving}
            error={podcastCrud.error}
            likedSet={social.likedSet}
            onDeleteEpisode={async (episode) => {
              await podcastCrud.removeEpisode(episode);

              if (featuredEpisode?.episodeId === episode.episodeId) {
                setFeaturedEpisode(null);
                setFeaturedAudioUrl(null);
              }
            }}
            onPlayEpisode={handlePlayEpisode}
            onToggleLike={handleToggleLike}
            onRequestEdit={composer.openEdit}
          />
        </section>
      </section>
    </>
  );
};

export default HomePage;
