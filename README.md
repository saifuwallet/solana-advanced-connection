# Solana Advanced Connection

Light wrapper around `Connection` with fallback to other RPCs when something goes wrong, and balancing strategies

## Install

```bash
yarn add solana-advanced-connection
```

or
```bash
npm install solana-advanced-connection
```

## Usage

Interface is identical to `Connection` except constructor

```typescript
import AdvancedConnectiotn from "solana-advanced-connection";

const rpc1 = "https://api.mainnet-beta.solana.com";
const rpc2 = "https://solana-api.projectserum.com";

const advCon = new AdvancedConnectiotn([rpc1, rpc2]);
advCon.getBalance(/* ... */);
```

### Balancing strategies

Comes with 3 strategies for your choosing:

- `sequential`: try each RPC in sequence for each call, will always start from first, then second, etc. (**default**)
- `round-robin`: round robin over all RPCs, across calls
- `random`: randomly pick RPCs

```typescript
import AdvancedConnection from "solana-advanced-connection";

const rpc1 = "https://api.mainnet-beta.solana.com";
const rpc2 = "https://solana-api.projectserum.com";

const advCon = new AdvancedConnection([rpc1, rpc2], {strategy: "random"});
advCon.getBalance(/* ... */);
```


## License

MIT, but please consider contributing back if you make improvements ❤️
