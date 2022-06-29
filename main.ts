import {Commitment, Connection, ConnectionConfig} from '@solana/web3.js';
import {Sequential} from "./strategy/sequential";
import Strategy from "./strategy";
import {RoundRobin} from "./strategy/roundrobin";
import {Random} from "./strategy/random";

interface AdvancedConnectionConfig {
  strategy?: 'sequential' | 'round-robin' | 'random';
  routes?: { allowFallback: boolean, method: string, endpoint: string }[];
}

class AdvancedConnection extends Connection {
  private readonly connections: Connection[]
  private readonly strategy: Strategy;
  private readonly overrides: Map<string, { allowFallback: boolean, connection: Connection}>

  constructor(
    endpoints: string[],
    commitmentOrConfig?: Commitment | ConnectionConfig,
    advancedConfig?: AdvancedConnectionConfig,
  ) {
    // basically don't care about super
    super(endpoints[0] || "", commitmentOrConfig);

    // store connections
    this.connections = endpoints.map((url) => new Connection(url, commitmentOrConfig));

    switch (advancedConfig?.strategy ?? 'sequential') {
      case "round-robin":
        this.strategy = new RoundRobin(this.connections);
        break;
      case "random":
        this.strategy = new Random(this.connections);
        break;
      default:
        this.strategy = new Sequential(this.connections);
        break;
    }

    this.overrides = new Map();
    advancedConfig?.routes?.forEach((route) => {
      let foundConnection = this.connections.find((con) => con.rpcEndpoint === route.endpoint);
      if (!foundConnection) {
        foundConnection = new Connection(route.endpoint, commitmentOrConfig);
      }

      this.overrides.set(route.method, {allowFallback: route.allowFallback, connection: foundConnection});
    });

    // keep reference to this
    const self = this;

    for (const property of Object.getOwnPropertyNames(Connection.prototype)) {
      // @ts-ignore
      if (typeof Connection.prototype[property] !== 'function') {
        continue;
      }

      // Remap all functions with a proxy function that does the exact same thing,
      // except it adds a fallback for when something goes wrong
      // @ts-ignore
      if (this[property].constructor.name === 'AsyncFunction') {
        // @ts-ignore
        this[property] = async function (...args) {
          return await self.executeWithCallback((con) => {
            // @ts-ignore
            return con[property].apply(con, args);
          }, property);
        }

        continue;
      }


      // Do the same for non async functions
      // @ts-ignore
      this[property] = function (...args) {
        let lastError;

        // overrides come first, if set
        if (self.overrides.has(property)) {
          const override = self.overrides.get(property);
          if (override) {
            try {
              // @ts-ignore
              return override.connection[property].apply(override.connection, args);
            } catch (e) {
              lastError = e;
            }

            if (!override.allowFallback) {
              if (lastError) {
                throw lastError;
              }
            }
          }
        }

        self.strategy.start();
        for (const conn of self.strategy.getConnection()) {
          try {
            // @ts-ignore
            return conn[property].apply(conn, args);
          } catch (e) {
            lastError = e;
          }
        }

        // re-throw last error
        if (lastError) {
          throw lastError;
        }
      }
    }
  }

  private executeWithCallback = async (callback: (connection: Connection) => Promise<any>, property: string) => {
    // start with main connection, then iterate through all backups
    let lastError;
    // overrides come first, if set
    if (this.overrides.has(property)) {
      const override = this.overrides.get(property);
      if (override) {
        try {
          return await callback(override.connection);
        } catch (e) {
          lastError = e;
        }

        if (!override.allowFallback) {
          if (lastError) {
            throw lastError;
          }
        }
      }
    }

    this.strategy.start();
    for (const conn of this.strategy.getConnection()) {
      try {
        return await callback(conn);
      } catch (e) {
        lastError = e;
      }
    }

    // if we went through all connections and it's still failing, throw the last error
    throw lastError;
  };
}

export default AdvancedConnection;
