# Solana Advanced Connection

Light wrapper around `Connection` with fallback to other RPCs when something goes wrong, load-balancing strategies and custom method routing.

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

### Function routing (make certain functions always go to certain RPCs)

Specify the `routes` key in config to override the routing for certain functions.
The following example will route `getBalance` to the Serum RPC, but allows fallback to the strategy if it fails.

Useful for when you want critical calls to always go to mainnet-beta for example.

```typescript
import AdvancedConnection from "solana-advanced-connection";

const rpc1 = "https://api.mainnet-beta.solana.com";
const rpc2 = "https://solana-api.projectserum.com";

const advCon = new AdvancedConnection([rpc1, rpc2], {strategy: "random", routes: [
    { allowFallback: true, method: "getBalance", endpoint: "https://solana-api.projectserum.com" }
]});

advCon.getBalance(/* ... */);
```

## License

MIT, but please consider contributing back if you make improvements ❤️
