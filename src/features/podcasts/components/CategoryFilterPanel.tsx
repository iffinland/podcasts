import '../styles/category-filter-panel.css';

interface CategoryFilterItem {
  name: string;
  count: number;
}

interface CategoryFilterPanelProps {
  categories: CategoryFilterItem[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

const CategoryFilterPanel = ({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterPanelProps) => {
  return (
    <section className="category-filter-panel">
      <div className="category-filter-panel__head">
        <h3>Browse by Category</h3>
        <button
          type="button"
          className={selectedCategory === null ? 'is-active' : ''}
          onClick={() => onSelectCategory(null)}
        >
          All Episodes
        </button>
      </div>

      <div className="category-filter-panel__chips">
        {categories.map((category) => (
          <button
            key={category.name}
            type="button"
            className={selectedCategory === category.name ? 'is-active' : ''}
            onClick={() => onSelectCategory(category.name)}
          >
            {category.name} ({category.count})
          </button>
        ))}
      </div>
    </section>
  );
};

export default CategoryFilterPanel;
