import {Commitment, Connection, ConnectionConfig} from '@solana/web3.js';
import {Sequential} from "./strategy/sequential";
import Strategy from "./strategy";
import {RoundRobin} from "./strategy/roundrobin";
import {Random} from "./strategy/random";

interface AdvancedConnectionConfig {
  strategy?: 'sequential' | 'round-robin' | 'random';
}

class AdvancedConnection extends Connection {
  private readonly connections: Connection[]
  private readonly strategy: Strategy;

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
          });
        }

        continue;
      }


      // Do the same for non async functions
      // @ts-ignore
      this[property] = function (...args) {
        self.strategy.start();
        let lastError;
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

  private executeWithCallback = async (callback: (connection: Connection) => Promise<any>) => {
    // start with main connection, then iterate through all backups
    let lastError;
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
