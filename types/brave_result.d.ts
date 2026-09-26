export {}

declare global {
  interface BraveSearchResult {
    query: Query
    mixed: Mixed
    type: string
    videos: Videos
    web: Web
  }

  interface Query {
    original: string
    show_strict_warning: boolean
    is_navigational: boolean
    is_news_breaking: boolean
    spellcheck_off: boolean
    country: string
    bad_results: boolean
    should_fallback: boolean
    postal_code: string
    city: string
    header_country: string
    more_results_available: boolean
    state: string
  }

  interface Mixed {
    type: string
    main: MainItem[]
    top: any[]
    side: any[]
  }

  interface MainItem {
    type: string
    index?: number
    all: boolean
  }

  interface Videos {
    type: string
    results: VideoResult[]
    mutated_by_goggles: boolean
  }

  interface VideoResult {
    type: string
    url: string
    title: string
    description: string
    age?: string
    page_age?: string
    fetched_content_timestamp?: number
    video?: VideoDetails
    meta_url: MetaUrl
    thumbnail?: Thumbnail
  }

  interface VideoDetails {
    duration?: string
    views?: number
    creator?: string
    publisher?: string
  }

  interface MetaUrl {
    scheme: string
    netloc: string
    hostname: string
    favicon: string
    path: string
  }

  interface Thumbnail {
    src: string
    original: string
  }

  interface Web {
    type: string
    results: SearchResult[]
    family_friendly: boolean
  }

  interface SearchResult {
    title: string
    url: string
    is_source_local: boolean
    is_source_both: boolean
    description: string
    profile: Profile
    language: string
    family_friendly: boolean
    type: string
    subtype: string
    is_live: boolean
    meta_url: MetaUrl
    cluster_type?: string
    cluster?: ClusterItem[]
    extra_snippets?: string[]
    thumbnail?: Thumbnail
    page_age?: string
    age?: string
  }

  interface Profile {
    name: string
    url: string
    long_name: string
    img: string
  }

  interface ClusterItem {
    title: string
    url: string
    is_source_local: boolean
    is_source_both: boolean
    description: string
    family_friendly: boolean
  }
}
