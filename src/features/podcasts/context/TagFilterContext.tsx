import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type TagCloudEntry = {
  tag: string;
  count: number;
};

interface TagFilterContextValue {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  topTags: TagCloudEntry[];
  setTopTags: (items: TagCloudEntry[]) => void;
}

const TagFilterContext = createContext<TagFilterContextValue | null>(null);

export const TagFilterProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [topTags, setTopTags] = useState<TagCloudEntry[]>([]);

  const value = useMemo(
    () => ({
      selectedTags,
      setSelectedTags,
      topTags,
      setTopTags,
    }),
    [selectedTags, topTags]
  );

  return <TagFilterContext.Provider value={value}>{children}</TagFilterContext.Provider>;
};

export const useTagFilter = () => {
  const context = useContext(TagFilterContext);

  if (!context) {
    throw new Error('useTagFilter must be used within TagFilterProvider');
  }

  return context;
};

export type { TagCloudEntry };
