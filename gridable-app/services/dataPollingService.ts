/**
 * @file Service for actively polling REST data sources and storing the data in OrbitDB.
 */

import type { AnyDataSourceConfig, RestDataSourceConfig } from '../types/dataSource';
import { DataSourceManagerService } from './dataSourceManager';
import { RestClientService } from './restClient';
import { RssParserService } from './rssParserService';

/**
 * A service that polls REST data sources at specified intervals and stores
 * the fetched data into designated OrbitDB document stores.
 */
export class DataPollingService {
  private dataSourceManager: DataSourceManagerService;
  private orbitdb: any;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initializes the DataPollingService.
   * @param dataSourceManager - An instance of DataSourceManagerService to get configurations.
   * @param orbitdb - The main OrbitDB instance.
   */
  constructor(dataSourceManager: DataSourceManagerService, orbitdb: any) {
    this.dataSourceManager = dataSourceManager;
    this.orbitdb = orbitdb;
  }

  /**
   * Starts the polling process for all configured data sources with a polling interval.
   */
  public async start(): Promise<void> {
    console.log('Starting data polling service...');
    const configs = await this.dataSourceManager.getAllDataSources();
    
    for (const config of configs) {
      if (config.pollingIntervalSeconds && config.pollingIntervalSeconds > 0) {
        const intervalId = setInterval(
          () => this.fetchAndStoreData(config),
          config.pollingIntervalSeconds * 1000
        );
        this.activeTimers.set(config.id, intervalId);
        console.log(`Polling scheduled for "${config.name}" (${config.id}) every ${config.pollingIntervalSeconds} seconds.`);
      }
    }
  }

  /**
   * Stops all active polling timers.
   */
  public stop(): void {
    console.log('Stopping data polling service...');
    this.activeTimers.forEach((timerId, configId) => {
      clearInterval(timerId);
      console.log(`Polling stopped for config ID: ${configId}`);
    });
    this.activeTimers.clear();
  }

  /**
   * Fetches data from a REST endpoint and stores it in an OrbitDB document store.
   * @param config - The data source configuration.
   */
  private async fetchAndStoreData(config: AnyDataSourceConfig): Promise<void> {
    console.log(`Fetching data for "${config.name}" from ${config.url}`);
    try {
      let data: any;

      switch (config.type) {
        case 'REST':
          const restClient = new RestClientService();
          data = await restClient.get<any>(config.url, { headers: config.headers });
          break;
        case 'RSS':
          data = await RssParserService.parse(config.url);
          break;
        default:
          console.error(`Unsupported data source type: ${(config as any).type}`);
          return;
      }

      if (!data) {
        console.warn(`No data received from "${config.name}".`);
        return;
      }

      const db = await this.orbitdb.open(config.targetDbAddress, { type: 'documents' });
      
      // Use a timestamp for a unique ID, or a dedicated field from the data if available.
      const doc = { _id: `poll_${Date.now()}`, data };
      
      await db.put(doc);
      console.log(`Successfully fetched and stored data for "${config.name}" in DB ${config.targetDbAddress}.`);

    } catch (error) {
      console.error(`Error polling data source "${config.name}":`, error);
    }
  }
}