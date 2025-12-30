// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DEX is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityBurned);
    event Swap(address indexed trader, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    /**
     * @notice Initialize the DEX with two token addresses
     * @param _tokenA Address of first token
     * @param _tokenB Address of second token
     */
    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token addresses");
        require(_tokenA != _tokenB, "Tokens must be different");
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    /// @notice Add liquidity to the pool
    /// @param amountA Amount of token A to add
    /// @param amountB Amount of token B to add
    /// @return liquidityMinted Amount of LP tokens minted
    function addLiquidity(uint256 amountA, uint256 amountB)
        external
        nonReentrant
        returns (uint256 liquidityMinted)
    {
        require(amountA > 0 && amountB > 0, "Amounts must be > 0");

        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);

        if (totalLiquidity == 0) {
            liquidityMinted = _sqrt(amountA * amountB);
            require(liquidityMinted > 0, "Insufficient liquidity minted");
            totalLiquidity = liquidityMinted;
            liquidity[msg.sender] = liquidityMinted;
        } else {
            // require exact ratio to keep implementation simple
            require(reserveA * amountB == reserveB * amountA, "Ratio mismatch");
            liquidityMinted = (amountA * totalLiquidity) / reserveA;
            require(liquidityMinted > 0, "Insufficient liquidity minted");
            totalLiquidity += liquidityMinted;
            liquidity[msg.sender] += liquidityMinted;
        }

        reserveA += amountA;
        reserveB += amountB;

        emit LiquidityAdded(msg.sender, amountA, amountB, liquidityMinted);
    }

    /// @notice Remove liquidity from the pool
    /// @param liquidityAmount Amount of LP tokens to burn
    /// @return amountA Amount of token A returned
    /// @return amountB Amount of token B returned
    function removeLiquidity(uint256 liquidityAmount)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        require(liquidityAmount > 0, "Amount must be > 0");
        require(liquidity[msg.sender] >= liquidityAmount, "Insufficient liquidity owned");
        require(totalLiquidity > 0, "No liquidity");

        amountA = (liquidityAmount * reserveA) / totalLiquidity;
        amountB = (liquidityAmount * reserveB) / totalLiquidity;

        liquidity[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;

        reserveA -= amountA;
        reserveB -= amountB;

        IERC20(tokenA).safeTransfer(msg.sender, amountA);
        IERC20(tokenB).safeTransfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidityAmount);
    }

    /// @notice Swap token A for token B
    /// @param amountAIn Amount of token A to swap
    /// @return amountBOut Amount of token B received
    function swapAForB(uint256 amountAIn)
        external
        nonReentrant
        returns (uint256 amountBOut)
    {
        require(amountAIn > 0, "Amount must be > 0");

        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountAIn);

        amountBOut = getAmountOut(amountAIn, reserveA, reserveB);
        require(amountBOut > 0 && amountBOut <= reserveB, "Insufficient output amount");

        reserveA += amountAIn;
        reserveB -= amountBOut;

        IERC20(tokenB).safeTransfer(msg.sender, amountBOut);

        emit Swap(msg.sender, tokenA, tokenB, amountAIn, amountBOut);
    }

    /// @notice Swap token B for token A
    /// @param amountBIn Amount of token B to swap
    /// @return amountAOut Amount of token A received
    function swapBForA(uint256 amountBIn)
        external
        nonReentrant
        returns (uint256 amountAOut)
    {
        require(amountBIn > 0, "Amount must be > 0");

        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountBIn);

        amountAOut = getAmountOut(amountBIn, reserveB, reserveA);
        require(amountAOut > 0 && amountAOut <= reserveA, "Insufficient output amount");

        reserveB += amountBIn;
        reserveA -= amountAOut;

        IERC20(tokenA).safeTransfer(msg.sender, amountAOut);

        emit Swap(msg.sender, tokenB, tokenA, amountBIn, amountAOut);
    }

    /// @notice Get current price of token A in terms of token B
    /// @return price Current price (reserveB / reserveA)
    function getPrice() external view returns (uint256 price) {
        if (reserveA == 0) return 0;
        return reserveB / reserveA;
    }

    /// @notice Get current reserves
    /// @return _reserveA Current reserve of token A
    /// @return _reserveB Current reserve of token B
    function getReserves() external view returns (uint256 _reserveA, uint256 _reserveB) {
        return (reserveA, reserveB);
    }

    /// @notice Calculate amount of token B received for given amount of token A
    /// @param amountAIn Amount of token A input
    /// @return amountBOut Amount of token B output (after 0.3% fee)
    function getAmountOut(uint256 amountAIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256 amountBOut)
    {
        require(amountAIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountAIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountBOut = numerator / denominator;
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y == 0) return 0;
        uint256 x = y / 2 + 1;
        z = y;
        while (x < z) {
            z = x;
            x = (y / x + x) / 2;
        }
    }

    /// @notice Test helper to expose `_sqrt` for unit tests
    /// @param y Input value
    /// @return z Square root of `y`
    function testSqrt(uint256 y) external pure returns (uint256 z) {
        return _sqrt(y);
    }
}
