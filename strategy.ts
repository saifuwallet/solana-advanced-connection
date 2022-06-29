import {Connection} from "@solana/web3.js";

export default interface Strategy {
  start(): void;
  getConnection(): IterableIterator<Connection>;
}
