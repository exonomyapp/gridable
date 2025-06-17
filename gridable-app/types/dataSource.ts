/**
 * @file Defines the data structure for configuring external data sources.
 */

/**
 * Represents the base configuration for any data source.
 */
export interface DataSourceConfig {
  /**
   * A unique identifier for the data source.
   */
  id: string;

  /**
   * A user-friendly name for the data source.
   */
  name: string;

  /**
   * The type of the data source.
   */
  type: 'REST' | 'RSS';

  /**
   * The URL for the data source.
   */
  url: string;

  /**
   * Optional frequency in seconds for polling the data source.
   */
  pollingIntervalSeconds?: number;

  /**
   * The address of the OrbitDB database where fetched data will be stored.
   */
  targetDbAddress: string;
}

/**
 * Represents the configuration for a single REST API data source.
 */
export interface RestDataSourceConfig extends DataSourceConfig {
  /**
   * The type of the data source.
   */
  type: 'REST';

  /**
   * Optional HTTP headers to be sent with each request.
   */
  headers?: Record<string, string>;
}

/**
 * Represents the configuration for a single RSS feed data source.
 */
export interface RssDataSourceConfig extends DataSourceConfig {
  /**
   * The type of the data source.
   */
  type: 'RSS';
}

/**
 * A union type representing any possible data source configuration.
 * This allows for type-safe handling of different source types.
 */
export type AnyDataSourceConfig = RestDataSourceConfig | RssDataSourceConfig;