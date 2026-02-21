import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type TagCloudEntry = {
  tag: string;
  count: number;
};

type CategoryCloudEntry = {
  name: string;
  count: number;
};

interface TagFilterContextValue {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  topTags: TagCloudEntry[];
  setTopTags: (items: TagCloudEntry[]) => void;
  allTags: TagCloudEntry[];
  setAllTags: (items: TagCloudEntry[]) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  topCategories: CategoryCloudEntry[];
  setTopCategories: (items: CategoryCloudEntry[]) => void;
  allCategories: CategoryCloudEntry[];
  setAllCategories: (items: CategoryCloudEntry[]) => void;
}

const TagFilterContext = createContext<TagFilterContextValue | null>(null);

export const TagFilterProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [topTags, setTopTags] = useState<TagCloudEntry[]>([]);
  const [allTags, setAllTags] = useState<TagCloudEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [topCategories, setTopCategories] = useState<CategoryCloudEntry[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryCloudEntry[]>([]);

  const value = useMemo(
    () => ({
      selectedTags,
      setSelectedTags,
      topTags,
      setTopTags,
      allTags,
      setAllTags,
      selectedCategory,
      setSelectedCategory,
      topCategories,
      setTopCategories,
      allCategories,
      setAllCategories,
    }),
    [
      allCategories,
      allTags,
      selectedCategory,
      selectedTags,
      topCategories,
      topTags,
    ]
  );

  return (
    <TagFilterContext.Provider value={value}>
      {children}
    </TagFilterContext.Provider>
  );
};

export const useTagFilter = () => {
  const context = useContext(TagFilterContext);

  if (!context) {
    throw new Error('useTagFilter must be used within TagFilterProvider');
  }

  return context;
};

export type { CategoryCloudEntry, TagCloudEntry };
