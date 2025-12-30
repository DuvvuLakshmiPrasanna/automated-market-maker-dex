const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Branch Booster - targeted operand coverage', function() {
  let dex, tokenA, tokenB, owner, addr1;

  beforeEach(async function() {
    [owner, addr1] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory('MockERC20');
    tokenA = await Mock.deploy('A','A');
    tokenB = await Mock.deploy('B','B');
    const DEX = await ethers.getContractFactory('DEX');
    dex = await DEX.deploy(tokenA.address, tokenB.address);
    // Approve a generous amount for convenience in tests
    await tokenA.approve(dex.address, ethers.constants.MaxUint256);
    await tokenB.approve(dex.address, ethers.constants.MaxUint256);
  });

    it('addLiquidity: amountA > 0 but amountB == 0 (second operand false)', async function() {
    await tokenA.mint(owner.address, ethers.utils.parseEther('10'));
    await tokenA.approve(dex.address, ethers.constants.MaxUint256);
    await expect(dex.addLiquidity(ethers.utils.parseEther('1'), 0)).to.be.revertedWith('AmountB must be > 0');
  });

    it('addLiquidity: amountA == 0 but amountB > 0 (first operand false)', async function() {
    await tokenB.mint(owner.address, ethers.utils.parseEther('10'));
    await tokenB.approve(dex.address, ethers.constants.MaxUint256);
    await expect(dex.addLiquidity(0, ethers.utils.parseEther('1'))).to.be.revertedWith('AmountA must be > 0');
  });

  it('getAmountOut: reserveIn == 0 but reserveOut > 0 (second operand false in reserves check)', async function() {
    await expect(dex.getAmountOut(ethers.utils.parseEther('1'), 0, ethers.utils.parseEther('1'))).to.be.revertedWith('Insufficient liquidity');
  });

  it('getAmountOut: reserveIn > 0 but reserveOut == 0 (first operand false in reserves check)', async function() {
    await expect(dex.getAmountOut(ethers.utils.parseEther('1'), ethers.utils.parseEther('1'), 0)).to.be.revertedWith('Insufficient liquidity');
  });

  it('getAmountOut: amountAIn == 0 (input operand false)', async function() {
    await expect(dex.getAmountOut(0, 1, 1)).to.be.revertedWith('Insufficient input amount');
  });

  it('swapAForB: amountAIn == 0 explicitly triggers require operand false', async function() {
    await expect(dex.swapAForB(0)).to.be.revertedWith('Amount must be > 0');
  });

  it('swapBForA: amountBIn == 0 explicitly triggers require operand false', async function() {
    await expect(dex.swapBForA(0)).to.be.revertedWith('Amount must be > 0');
  });
});
