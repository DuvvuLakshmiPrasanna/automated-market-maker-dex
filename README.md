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

# DEX AMM Project

## Overview

This repository implements a simplified Decentralized Exchange (DEX) using an Automated Market Maker (AMM) with the constant-product formula x \* y = k. The DEX supports:

- Adding and removing liquidity with LP accounting
- Swapping between two ERC-20 tokens using the constant-product formula
- A 0.3% trading fee that accrues to liquidity providers

This implementation is intended for learning and evaluation purposes (matching the project specification).

## Features

- Initial and subsequent liquidity provision
- Liquidity removal with proportional share calculation
- Token swaps using constant product formula (x \* y = k)
- 0.3% trading fee for liquidity providers
- LP token accounting (integrated within `DEX.sol`)

## Repository Structure

- `contracts/DEX.sol` — Core AMM contract with required public functions and events
- `contracts/MockERC20.sol` — Simple ERC-20 token (mintable) used in tests
- `test/DEX.test.js` — Comprehensive test suite (27 tests)
- `scripts/deploy.js` — Example local deployment script
- `Dockerfile`, `docker-compose.yml`, `.dockerignore` — Containerized test environment
- `hardhat.config.js`, `package.json` — Project configuration
- `README.md` — This file

## Mathematical Implementation

### Constant Product Formula

The pool maintains the invariant x \* y = k (x = reserveA, y = reserveB). Swaps change reserves while approximately preserving this invariant; because fees are kept in the pool, k increases slightly over time.

### Fee Calculation (0.3%)

For an input amount `amountIn` (on the input token), the effective amount after fee is:

amountInWithFee = amountIn \* 997

Output amount is computed as:

amountOut = (amountInWithFee _ reserveOut) / (reserveIn _ 1000 + amountInWithFee)

This implements a 0.3% fee (3/1000) which stays in the pool.

### LP Token Minting

- Initial provider: `liquidityMinted = sqrt(amountA * amountB)`
- Subsequent providers: `liquidityMinted = (amountA * totalLiquidity) / reserveA` (requires matching ratio in this implementation)

## Tests and Coverage

- Unit tests: `27 passing` (run with `npx hardhat test`) — implemented in `test/DEX.test.js` covering liquidity management, swaps, price queries, fees, edge cases, and events.
- Coverage (solidity-coverage):
  - Statements: 97.56%
  - Branch: 65.91%
  - Functions: 100%
  - Lines: 100%

To run tests and coverage locally:

```bash
npm install
npx hardhat compile
npx hardhat test
npm run coverage
```

Note: `solidity-coverage` is used for coverage; install it if needed (`npm i -D solidity-coverage`).

## Setup & Usage

With Docker (recommended for evaluation):

```bash
git clone <your-repo-url>
cd automated-market-maker-dex
docker-compose build --no-cache
docker-compose up -d
docker-compose exec app npm run compile
docker-compose exec app npm test
docker-compose exec app npm run coverage
docker-compose down
```

Without Docker (local):

```bash
npm install
npx hardhat compile
npx hardhat test
npm run coverage
```

## Submission Checklist

- All required files present: `contracts/`, `test/`, `scripts/`, Docker config, `hardhat.config.js`, `package.json`, `README.md`.
- Contracts compile without errors.
- Tests pass (`27 passing`).
- Coverage generated (see above).
- Events and function signatures implemented as specified.
- `README.md` includes setup and verification steps.

If you want a ready archive for submission, you can produce a zip from the project root:

```powershell
# from project root (Windows PowerShell)
Compress-Archive -Path . -DestinationPath ..\dex-amm-submission.zip -Force
```

Or use git archive:

```bash
# create a git commit and then
git archive -o ../dex-amm-submission.zip HEAD
```

## Known Limitations & Next Improvements

- Subsequent liquidity additions require exact ratio (UX improvement: accept optimal amounts and refund excess).
- No slippage protection (`minAmountOut`) or deadlines implemented — these are recommended for production.
- Branch coverage is lower than statement coverage; add tests covering revert/error branches to improve it.

## Security Considerations

- Uses OpenZeppelin `SafeERC20` and `ReentrancyGuard` to mitigate common risks.
- Input validation prevents zero amounts and checks ownership when burning liquidity.
- Recommended: run static analysis tools such as Slither and perform manual audits before any real deployment.

## Contact / Next Steps

Tell me which of the following you'd like me to do next:

- Push the repository to a new GitHub repo and create a submission branch + tag.
- Produce the zip archive for you and place it in the parent directory.
- Run Slither (requires installing Slither and Docker support).
- Implement optional features (slippage protection, deadlines, separate LP token contract).

All core requirements are implemented and verified. If you want, I can now prepare the final submission artifact (zip and a checklist).
