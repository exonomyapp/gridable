import Parser from 'rss-parser';

/**
 * A service for fetching and parsing RSS feeds.
 */
export class RssParserService {
  private static parser = new Parser();

  /**
   * Fetches and parses an RSS feed from the given URL.
   *
   * @param feedUrl The URL of the RSS feed to parse.
   * @returns A promise that resolves with the parsed feed data as a JSON object.
   */
  public static async parse(feedUrl: string): Promise<any> {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      return feed;
    } catch (error) {
      console.error(`Error parsing RSS feed from ${feedUrl}:`, error);
      throw new Error('Failed to parse RSS feed.');
    }
  }
}