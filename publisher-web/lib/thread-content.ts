// Matches the existing Notion → Typefully adapter's four-newline delimiter.
export const threadChannels = ['X', 'Threads', 'Bluesky', 'Mastodon'];
export function threadPosts(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n\n\n\n');
}
export function threadText(posts: string[]): string {
  return posts.join('\n\n\n\n');
}
