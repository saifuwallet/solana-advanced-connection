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

  describe('overrides', () => {
    it('routes to correct connection', async function() {
      class SomeConnection extends Connection {
        get rpcEndpoint(): string {
          return "fakecon";
        }

        async getSlot(commitment?: Commitment): Promise<number> {
          return 555;
        }
      }

      const con = new AdvancedConnection(["https://google.com/"]);
      // @ts-ignore
      con['connections'] = [getFake(3)];
      // @ts-ignore
      con['strategy'] = new Random(con['connections']);

      const overrides = new Map();
      overrides.set('getSlot', {allowFallback: false, connection: new SomeConnection("https://google.com")});

      // @ts-ignore
      con['overrides'] = overrides

      // goes to normal con
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(3);

      // should get routed to other con
      expect(await con.getSlot('confirmed')).eq(555);
    });

    it('returns error when not allowed to fallback', async function() {
      const con = new AdvancedConnection(["https://google.com/"]);
      // @ts-ignore
      con['connections'] = [getFake(3)];
      // @ts-ignore
      con['strategy'] = new Random(con['connections']);

      const overrides = new Map();
      overrides.set('getBalance', {allowFallback: false, connection: getErr()});

      // @ts-ignore
      con['overrides'] = overrides

      // gets routed to errCon, does not allow to fallback
      const r = con.getBalance(Keypair.generate().publicKey)
      await expect(r).to.eventually.rejectedWith("can't do that, rpc is kill")
    });

    it('falls back to other strategy if allowed', async function() {
      const con = new AdvancedConnection(["https://google.com/"]);
      // @ts-ignore
      con['connections'] = [getFake(3)];
      // @ts-ignore
      con['strategy'] = new Random(con['connections']);

      const overrides = new Map();
      overrides.set('getBalance', {allowFallback: true, connection: getErr()});

      // @ts-ignore
      con['overrides'] = overrides

      // gets routed to errCon, then falls back to strategy
      expect(await con.getBalance(Keypair.generate().publicKey)).eq(3);
    });
  });
});
