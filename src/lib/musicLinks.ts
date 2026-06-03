export function spotifySearchUrl(artist: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(`artist:${artist}`)}`;
}

export function youtubeMusicSearchUrl(artist: string) {
  return `https://music.youtube.com/search?q=${encodeURIComponent(artist)}`;
}
