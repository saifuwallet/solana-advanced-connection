import {describe} from "mocha";
import AdvancedConnection from "./main";
import {Commitment, Connection, Keypair, PublicKey} from "@solana/web3.js";
import {expect, use} from "chai";
import chaiAsPromised from 'chai-as-promised';
import {Sequential} from "./strategy/sequential";
import {RoundRobin} from "./strategy/roundrobin";
import {Random} from "./strategy/random";

use(chaiAsPromised);

class FakeConnection extends Connection {
  constructor(endpoint: string, private retValue: number) {
    super(endpoint);
  }

  get rpcEndpoint(): string {
    return "fakecon";
  }

  public called = false;

  async getBalance(publicKey: PublicKey, commitment?: Commitment): Promise<number> {
    this.called = true;
    return this.retValue;
  }
}

class ErrConnection extends Connection {
  get rpcEndpoint(): string {
    return "errcon";
  }

  public called = false;

  async getBalance(publicKey: PublicKey, commitment?: Commitment): Promise<number> {
    this.called = true;
    throw new Error("can't do that, rpc is kill")
  }
}

function getFake(retVal = 123) {
  return new FakeConnection("https://google.com", retVal);
}

function getErr() {
  return new ErrConnection("https://google.com");
}

describe('solana-fallback-connection', () => {
  it('should fallback to valid connection on error', async function () {
    const con = new AdvancedConnection(["https://google.com/"]);
    // overwrite connections property with some fake ones
    // @ts-ignore
    con['connections'] = [getErr(), getErr(), getErr(), getFake()];
    // @ts-ignore
    con['strategy'] = new Sequential(con['connections']);

    const r = await con.getBalance(Keypair.generate().publicKey)
    // should be 123, the return value of the fakeCon that's in the end
    expect(r).eq(123)

    // check that all conns got called
    con['connections'].forEach((c) => {
      expect((c as FakeConnection).called).true;
    })
  });

  it('should return the last error', async function () {
    const con = new AdvancedConnection(["https://google.com/"]);
    // overwrite connections property with some fake ones
    // @ts-ignore
    con['connections'] = [getErr(), getErr(), getErr()];
    // @ts-ignore
    con['strategy'] = new Sequential(con['connections']);

    const r = con.getBalance(Keypair.generate().publicKey)
    await expect(r).to.eventually.rejectedWith("can't do that, rpc is kill")
  });

  describe('strategy sequential', () => {
    it('should always start from first', async function () {
      const con = new AdvancedConnection(["https://google.com/"]);
      // overwrite connections property with some fake ones
      // @ts-ignore
      con['connections'] = [getFake(1), getFake(2), getFake(3)];
      // @ts-ignore
      con['strategy'] = new Sequential(con['connections']);

      expect(await con.getBalance(Keypair.generate().publicKey)).eq(1);
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(1);
    });

    it('should fallback to next on error', async function () {
      const con = new AdvancedConnection(["https://google.com/"]);
      // overwrite connections property with some fake ones
      // @ts-ignore
      con['connections'] = [getErr(), getFake(2), getFake(3)];
      // @ts-ignore
      con['strategy'] = new Sequential(con['connections']);

      expect(await con.getBalance(Keypair.generate().publicKey)).eq(2);
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(2);
    });
  });

  describe('strategy roundrobin', () => {
    it('should round robin', async function () {
      const con = new AdvancedConnection(["https://google.com/"]);
      // overwrite connections property with some fake ones
      // @ts-ignore
      con['connections'] = [getFake(1), getFake(2), getFake(3)];
      // @ts-ignore
      con['strategy'] = new RoundRobin(con['connections']);

      expect(await con.getBalance(Keypair.generate().publicKey)).eq(1);
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(2);
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(3);
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(1);
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(2);
    });

    it('should round robin on error', async function () {
      const con = new AdvancedConnection(["https://google.com/"]);
      // overwrite connections property with some fake ones
      // @ts-ignore
      con['connections'] = [getFake(1), getErr(), getFake(3)];
      // @ts-ignore
      con['strategy'] = new RoundRobin(con['connections']);

      expect(await con.getBalance(Keypair.generate().publicKey)).eq(1);
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(3); // fallback to con 3
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(1);
    });

    it('should return last err', async function () {
      const con = new AdvancedConnection(["https://google.com/"]);
      // overwrite connections property with some fake ones
      // @ts-ignore
      con['connections'] = [getErr(), getErr(), getErr()];
      // @ts-ignore
      con['strategy'] = new RoundRobin(con['connections']);

      const r = con.getBalance(Keypair.generate().publicKey)
      await expect(r).to.eventually.rejectedWith("can't do that, rpc is kill")
    });
  });

  describe('strategy random', () => {
    it('should eventually return correct result', async function () {
      const con = new AdvancedConnection(["https://google.com/"]);
      // overwrite connections property with some fake ones
      // @ts-ignore
      con['connections'] = [getErr(), getErr(), getFake(3), getErr()];
      // @ts-ignore
      con['strategy'] = new Random(con['connections']);

      expect(await con.getBalance(Keypair.generate().publicKey)).eq(3);
    });
  });
});
