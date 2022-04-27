import {describe} from "mocha";
import FallbackConnection from "./main";
import {Commitment, Connection, Keypair, PublicKey} from "@solana/web3.js";
import {expect, use} from "chai";
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

class FakeConnection extends Connection {
  get rpcEndpoint(): string {
    return "fakecon";
  }

  public called = false;

  async getBalance(publicKey: PublicKey, commitment?: Commitment): Promise<number> {
    this.called = true;
    return 123;
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

function getFake() {
  return new FakeConnection("https://google.com");
}

function getErr() {
  return new ErrConnection("https://google.com");
}

describe('solana-fallback-connection', () => {
  it('should fallback to valid connection on error', async function () {
    const con = new FallbackConnection(["https://google.com/"]);
    // overwrite connections property with some fake ones
    // @ts-ignore
    con['connections'] = [getErr(), getErr(), getErr(), getFake()];

    const r = await con.getBalance(Keypair.generate().publicKey)
    // should be 123, the return value of the fakeCon that's in the end
    expect(r).eq(123)

    // check that all conns got called
    con['connections'].forEach((c) => {
      expect((c as FakeConnection).called).true;
    })
  });

  it('should return the last error', async function () {
    const con = new FallbackConnection(["https://google.com/"]);
    // overwrite connections property with some fake ones
    // @ts-ignore
    con['connections'] = [getErr(), getErr(), getErr()];

    const r = con.getBalance(Keypair.generate().publicKey)
    await expect(r).to.eventually.rejectedWith("can't do that, rpc is kill")
  });
});
