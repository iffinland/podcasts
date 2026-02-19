import { requestQortal } from '../qortal/qortalClient';

const likesListName = (activeName: string) =>
  `qpodcasts-likes-${activeName.toLowerCase()}`;
const playlistsListName = (activeName: string) =>
  `qpodcasts-playlists-${activeName.toLowerCase()}`;
const playlistItemsListName = (activeName: string, playlistName: string) => {
  const normalized = playlistName.toLowerCase().replace(/\s+/g, '-');
  return `qpodcasts-playlist-items-${activeName.toLowerCase()}-${normalized}`;
};

const normalizeListResponse = (response: unknown): string[] => {
  if (!Array.isArray(response)) {
    return [];
  }

  return response
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }

      if (entry && typeof entry === 'object') {
        const objectValue = entry as { item?: string; value?: string };
        return objectValue.item ?? objectValue.value ?? null;
      }

      return null;
    })
    .filter((value): value is string =>
      Boolean(value && value.trim().length > 0)
    );
};

const getListItems = async (listName: string): Promise<string[]> => {
  const response = await requestQortal<unknown>({
    action: 'GET_LIST_ITEMS',
    list_name: listName,
  });

  return normalizeListResponse(response);
};

export const loadLikedEpisodeKeys = async (
  activeName: string
): Promise<string[]> => {
  return getListItems(likesListName(activeName));
};

export const addLike = async (
  activeName: string,
  episodeKey: string
): Promise<void> => {
  await requestQortal<unknown>({
    action: 'ADD_LIST_ITEMS',
    list_name: likesListName(activeName),
    items: [episodeKey],
  });
};

export const removeLike = async (
  activeName: string,
  episodeKey: string
): Promise<void> => {
  await requestQortal<unknown>({
    action: 'DELETE_LIST_ITEM',
    list_name: likesListName(activeName),
    items: [episodeKey],
  });
};

export const loadPlaylistNames = async (
  activeName: string
): Promise<string[]> => {
  return getListItems(playlistsListName(activeName));
};

export const createPlaylist = async (
  activeName: string,
  playlistName: string
): Promise<void> => {
  await requestQortal<unknown>({
    action: 'ADD_LIST_ITEMS',
    list_name: playlistsListName(activeName),
    items: [playlistName],
  });
};

export const loadPlaylistEpisodeKeys = async (
  activeName: string,
  playlistName: string
): Promise<string[]> => {
  return getListItems(playlistItemsListName(activeName, playlistName));
};

export const addEpisodeToPlaylist = async (
  activeName: string,
  playlistName: string,
  episodeKey: string
): Promise<void> => {
  await requestQortal<unknown>({
    action: 'ADD_LIST_ITEMS',
    list_name: playlistItemsListName(activeName, playlistName),
    items: [episodeKey],
  });
};

export const removeEpisodeFromPlaylist = async (
  activeName: string,
  playlistName: string,
  episodeKey: string
): Promise<void> => {
  await requestQortal<unknown>({
    action: 'DELETE_LIST_ITEM',
    list_name: playlistItemsListName(activeName, playlistName),
    items: [episodeKey],
  });
};
