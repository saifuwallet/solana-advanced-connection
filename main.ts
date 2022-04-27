import {Commitment, Connection, ConnectionConfig} from '@solana/web3.js';

class FallbackConnection extends Connection {
  private readonly connections: Connection[]

  constructor(
    endpoints: string[],
    commitmentOrConfig?: Commitment | ConnectionConfig,
  ) {
    // basically don't care about super
    super(endpoints[0] || "", commitmentOrConfig);

    // store connections
    this.connections = endpoints.map((url) => new Connection(url, commitmentOrConfig));

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
        let lastError;
        for (const conn of self.connections) {
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
    for (const conn of this.connections) {
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

export default FallbackConnection;
