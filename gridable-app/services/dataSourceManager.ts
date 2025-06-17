/**
 * @file Manages configurations for external REST data sources using an OrbitDB key-value store.
 */

import type { AnyDataSourceConfig, RestDataSourceConfig } from '../types/dataSource';

/**
 * Service to manage CRUD operations for REST data source configurations.
 */
export class DataSourceManagerService {
  private db: any; // OrbitDB KeyValue store instance

  /**
   * Initializes the service with an OrbitDB instance and the name for the configuration database.
   * @param orbitdb - The OrbitDB instance.
   * @param dbName - The name of the database to store configurations.
   */
  async initialize(orbitdb: any, dbName: string): Promise<void> {
    this.db = await orbitdb.keyvalue(dbName);
    await this.db.load();
  }

  /**
   * Adds a new data source configuration.
   * @param config - The data source configuration to add.
   */
  async addDataSource(config: AnyDataSourceConfig): Promise<void> {
    if (!this.db) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    await this.db.put(config.id, config);
  }

  /**
   * Retrieves a data source configuration by its ID.
   * @param id - The ID of the data source to retrieve.
   * @returns The configuration object or undefined if not found.
   */
  async getDataSource(id: string): Promise<AnyDataSourceConfig | undefined> {
    if (!this.db) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    return this.db.get(id);
  }

  /**
   * Retrieves all data source configurations.
   * @returns An array of all configuration objects.
   */
  async getAllDataSources(): Promise<AnyDataSourceConfig[]> {
    if (!this.db) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    const all = this.db.all;
    return Object.values(all);
  }

  /**
   * Updates an existing data source configuration.
   * @param id - The ID of the data source to update.
   * @param config - An object with the properties to update.
   */
  async updateDataSource(id: string, config: Partial<AnyDataSourceConfig>): Promise<void> {
    if (!this.db) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    const existingConfig = await this.getDataSource(id);
    if (!existingConfig) {
      throw new Error(`Data source with id "${id}" not found.`);
    }
    const updatedConfig = { ...existingConfig, ...config };
    await this.db.put(id, updatedConfig);
  }

  /**
   * Removes a data source configuration.
   * @param id - The ID of the data source to remove.
   */
  async removeDataSource(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    await this.db.del(id);
  }
}