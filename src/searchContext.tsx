// searchContext.tsx

import { createContext } from "react";

interface SearchContextProps {
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

const defaultValue: SearchContextProps = {
    searchTerm: '',
    setSearchTerm: () => {}  // Default bir fonksiyon.
  }

  const SearchContext = createContext<SearchContextProps>(defaultValue);

export default SearchContext;
