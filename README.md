# Solana Connection with Fallback

Light wrapper around `Connection` with fallback to other RPCs when something goes wrong.

## Install

```bash
yarn add solana-fallback-connection
```

or
```
npm install solana-fallback-connection
```

## Usage

Interface is identical to `Connection` except constructor

```typescript
import FallbackConnection from "solana-fallback-connection";

const rpc1 = "https://api.mainnet-beta.solana.com";
const rpc2 = "https://solana-api.projectserum.com";

const fallbackConnection = new FallbackConnection([rpc1, rpc2]);
fallbackConnection.getBalance(/* ... */);
```

## License

MIT, but please consider contributing back if you make improvements ❤️
