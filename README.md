# DEX AMM Project

## Overview

This repository contains a simplified Decentralized Exchange (DEX) implementing an Automated Market Maker (AMM) following the constant product model (x \* y = k). It supports liquidity provision, LP tokens accounting, token swaps with a 0.3% fee, and liquidity removal.

## Features

- Initial and subsequent liquidity provision
- Liquidity removal with proportional share calculation
- Token swaps using constant product formula (x \* y = k)
- 0.3% trading fee for liquidity providers
- LP token accounting (mint/burn integrated in `DEX.sol`)

## Architecture

The project includes two contracts:

- `DEX.sol`: Core AMM logic, liquidity accounting, swaps, fee handling, events.
- `MockERC20.sol`: Simple ERC-20 token used for testing.

Design decisions:

- LP token accounting is implemented within `DEX.sol` using `liquidity` mapping and `totalLiquidity`.
- Subsequent liquidity additions require matching the pool ratio for simplicity.
- Fees are applied as 0.3% (997/1000) and remain in the pool, benefiting LPs.

## Mathematical Implementation

### Constant Product Formula

The AMM preserves the invariant x \* y = k where x and y are reserves. Swaps adjust reserves while preserving the formula when fees are considered.

### Fee Calculation

Fee is applied on input amount before calculating output:

amountInWithFee = amountIn _ 997
amountOut = (amountInWithFee _ reserveOut) / (reserveIn \* 1000 + amountInWithFee)

0.3% fee (1000 - 997 = 3) stays in the pool.

### LP Token Minting

Initial provider receives sqrt(amountA _ amountB) LP tokens. Subsequent providers receive tokens proportional to amountA relative to reserveA: liquidityMinted = (amountA _ totalLiquidity) / reserveA.

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- Git

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd dex-amm
```

2. Start Docker environment:

```bash
docker-compose up -d
```

3. Compile contracts:

```bash
docker-compose exec app npm run compile
```

4. Run tests:

```bash
docker-compose exec app npm test
```

5. Check coverage:

```bash
docker-compose exec app npm run coverage
```

6. Stop Docker:

```bash
docker-compose down
```

## Running Tests Locally (without Docker)

```bash
npm install
npm run compile
npm test
```

## Contract Addresses

None deployed by default. Use `npm run deploy` with Hardhat to deploy locally.

## Known Limitations

- Subsequent liquidity additions require exact ratio to avoid complexity.
- No slippage protection parameters (minAmountOut) implemented.

## Security Considerations

- Uses OpenZeppelin `SafeERC20` and `ReentrancyGuard`.
- Input validation and checks for zero amounts are in place.
