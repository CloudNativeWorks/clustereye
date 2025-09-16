/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REACT_APP_API_URL: string
  // diğer env variable'ları buraya ekleyebilirsiniz
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
