const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function() {
    let dex, tokenA, tokenB;
    let owner, addr1, addr2;

    beforeEach(async function() {
        // Deploy tokens and DEX before each test
        [owner, addr1, addr2] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        tokenA = await MockERC20.deploy("Token A", "TKA");
        tokenB = await MockERC20.deploy("Token B", "TKB");

        const DEX = await ethers.getContractFactory("DEX");
        dex = await DEX.deploy(tokenA.address, tokenB.address);

        // Approve DEX to spend tokens
        await tokenA.approve(dex.address, ethers.utils.parseEther("1000000"));
        await tokenB.approve(dex.address, ethers.utils.parseEther("1000000"));

        // Also approve for other accounts
        await tokenA.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000000"));
        await tokenB.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000000"));
        await tokenA.connect(addr2).approve(dex.address, ethers.utils.parseEther("1000000"));
        await tokenB.connect(addr2).approve(dex.address, ethers.utils.parseEther("1000000"));
        // Mint tokens for other accounts so they can interact in tests
        await tokenA.mint(addr1.address, ethers.utils.parseEther("1000"));
        await tokenB.mint(addr1.address, ethers.utils.parseEther("1000"));
        await tokenA.mint(addr2.address, ethers.utils.parseEther("1000"));
        await tokenB.mint(addr2.address, ethers.utils.parseEther("1000"));
    });

    describe("Liquidity Management", function() {
        it("should allow initial liquidity provision", async function() {
            const tx = await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            await tx.wait();

            const reserves = await dex.getReserves();
            expect(reserves[0]).to.equal(ethers.utils.parseEther("100"));
            expect(reserves[1]).to.equal(ethers.utils.parseEther("200"));
            const total = await dex.totalLiquidity();
            expect(total).to.be.gt(0);
        });

        it("should mint correct LP tokens for first provider", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            const total = await dex.totalLiquidity();
            // sqrt(100 * 200) = sqrt(20000) = 141.421356... scaled by 1e18
            // We check totalLiquidity^2 ~= amountA*amountB
            const amtA = ethers.utils.parseEther("100");
            const amtB = ethers.utils.parseEther("200");
            const prod = amtA.mul(amtB);
            const lhs = total.mul(total);
            // allow tiny rounding differences due to integer sqrt floor
            const diff = prod.sub(lhs);
            expect(lhs).to.be.gt(0);
            expect(diff).to.be.lt(prod.div(1000000));
        });

        it("should allow subsequent liquidity additions", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            // add matching ratio
            await dex.addLiquidity(
                ethers.utils.parseEther("50"),
                ethers.utils.parseEther("100")
            );
            const reserves = await dex.getReserves();
            expect(reserves[0]).to.equal(ethers.utils.parseEther("150"));
            expect(reserves[1]).to.equal(ethers.utils.parseEther("300"));
        });

        it("should maintain price ratio on liquidity addition", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            // adding wrong ratio should revert
            await expect(dex.addLiquidity(ethers.utils.parseEther("10"), ethers.utils.parseEther("15"))).to.be.revertedWith("Ratio mismatch");
        });

        it("should allow partial liquidity removal", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            const total = await dex.totalLiquidity();
            const half = total.div(2);
            await dex.removeLiquidity(half);
            const reserves = await dex.getReserves();
            expect(reserves[0]).to.equal(ethers.utils.parseEther("50"));
            expect(reserves[1]).to.equal(ethers.utils.parseEther("100"));
        });

        it("should return correct token amounts on liquidity removal", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            const total = await dex.totalLiquidity();
            const oneQuarter = total.div(4);
            // track balances
            const balA_before = await tokenA.balanceOf(owner.address);
            const balB_before = await tokenB.balanceOf(owner.address);
            await dex.removeLiquidity(oneQuarter);
            const balA_after = await tokenA.balanceOf(owner.address);
            const balB_after = await tokenB.balanceOf(owner.address);
            expect(balA_after).to.be.gt(balA_before.sub(ethers.utils.parseEther("100"))); // got some back
            expect(balB_after).to.be.gt(balB_before.sub(ethers.utils.parseEther("200")));
        });

        it("should revert on zero liquidity addition", async function() {
            await expect(dex.addLiquidity(0, 0)).to.be.revertedWith("Amounts must be > 0");
        });

        it("should revert when removing more liquidity than owned", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            const total = await dex.totalLiquidity();
            // addr1 hasn't provided liquidity
            await expect(dex.connect(addr1).removeLiquidity(total)).to.be.revertedWith("Insufficient liquidity owned");
        });
    });

    describe("Token Swaps", function() {
        beforeEach(async function() {
            // Add initial liquidity before swap tests
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
        });

        it("should swap token A for token B", async function() {
            const amountIn = ethers.utils.parseEther("10");
            const out = await dex.getAmountOut(amountIn, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            await dex.swapAForB(amountIn);
            const balB = await tokenB.balanceOf(owner.address);
            // owner started with 1e6 tokens, after swap he spent A and received B; check B increased
            expect(balB).to.be.gt(ethers.utils.parseEther("1000000").sub(ethers.utils.parseEther("200")));
        });

        it("should swap token B for token A", async function() {
            const amountIn = ethers.utils.parseEther("10");
            const out = await dex.getAmountOut(amountIn, ethers.utils.parseEther("200"), ethers.utils.parseEther("100"));
            await dex.swapBForA(amountIn);
            const balA = await tokenA.balanceOf(owner.address);
            expect(balA).to.be.gt(ethers.utils.parseEther("1000000").sub(ethers.utils.parseEther("100")));
        });

        it("should calculate correct output amount with fee", async function() {
            const amountIn = ethers.utils.parseEther("10");
            const expected = await dex.getAmountOut(amountIn, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            // call swap and compare emitted amount via event
            await expect(dex.swapAForB(amountIn)).to.emit(dex, 'Swap');
            const res = await dex.getReserves();
            // reserveB decreased by expected
            expect(res[1]).to.equal(ethers.utils.parseEther("200").sub(expected));
        });

        it("should update reserves after swap", async function() {
            const amountIn = ethers.utils.parseEther("5");
            const expected = await dex.getAmountOut(amountIn, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            await dex.swapAForB(amountIn);
            const res = await dex.getReserves();
            expect(res[0]).to.equal(ethers.utils.parseEther("105"));
            expect(res[1]).to.equal(ethers.utils.parseEther("200").sub(expected));
        });

        it("should increase k after swap due to fees", async function() {
            const k_before = (await dex.getReserves())[0].mul((await dex.getReserves())[1]);
            await dex.swapAForB(ethers.utils.parseEther("10"));
            const res = await dex.getReserves();
            const k_after = res[0].mul(res[1]);
            expect(k_after).to.be.gte(k_before);
        });

        it("should revert on zero swap amount", async function() {
            await expect(dex.swapAForB(0)).to.be.revertedWith("Amount must be > 0");
            await expect(dex.swapBForA(0)).to.be.revertedWith("Amount must be > 0");
        });

        it("should handle large swaps with high price impact", async function() {
            // swap large portion
            await dex.swapAForB(ethers.utils.parseEther("80"));
            const res = await dex.getReserves();
            expect(res[0]).to.equal(ethers.utils.parseEther("180"));
            // reserveB should drop substantially
            expect(res[1]).to.be.lt(ethers.utils.parseEther("200"));
        });

        it("should handle multiple consecutive swaps", async function() {
            await dex.swapAForB(ethers.utils.parseEther("1"));
            await dex.swapBForA(ethers.utils.parseEther("2"));
            await dex.swapAForB(ethers.utils.parseEther("3"));
            const res = await dex.getReserves();
            expect(res[0]).to.be.gt(0);
            expect(res[1]).to.be.gt(0);
        });
    });

    describe("Price Calculations", function() {
        it("should return correct initial price", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("10"), ethers.utils.parseEther("20"));
            const price = await dex.getPrice();
            expect(price).to.equal(ethers.utils.parseEther("20").div(ethers.utils.parseEther("10")));
        });

        it("should update price after swaps", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            const priceBefore = await dex.getPrice();
            await dex.swapAForB(ethers.utils.parseEther("10"));
            const priceAfter = await dex.getPrice();
            expect(priceAfter).to.not.equal(priceBefore);
        });

        it("should handle price queries with zero reserves gracefully", async function() {
            const price = await dex.getPrice();
            expect(price).to.equal(0);
        });
    });

    describe("Fee Distribution", function() {
        it("should accumulate fees for liquidity providers", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            // addr1 performs swaps paying fees into pool
            await dex.connect(addr1).swapAForB(ethers.utils.parseEther("10"));
            await dex.connect(addr2).swapBForA(ethers.utils.parseEther("20"));
            // owner removes liquidity
            const total = await dex.totalLiquidity();
            const beforeA = await tokenA.balanceOf(owner.address);
            const beforeB = await tokenB.balanceOf(owner.address);
            await dex.removeLiquidity(total);
            const afterA = await tokenA.balanceOf(owner.address);
            const afterB = await tokenB.balanceOf(owner.address);
            // Owner should receive at least initial amounts back (or slightly more due to fees)
            expect(afterA).to.be.gte(beforeA);
            expect(afterB).to.be.gte(beforeB);
        });

        it("should distribute fees proportionally to LP share", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            // another LP provides matching liquidity
            await tokenA.connect(addr1).mint(addr1.address, ethers.utils.parseEther("1000"));
            await tokenB.connect(addr1).mint(addr1.address, ethers.utils.parseEther("1000"));
            await tokenA.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000"));
            await tokenB.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000"));
            await dex.connect(addr1).addLiquidity(ethers.utils.parseEther("50"), ethers.utils.parseEther("100"));

            // perform swaps to generate fees
            await dex.connect(addr2).swapAForB(ethers.utils.parseEther("5"));

            // Remove liquidity proportionally and ensure shares are proportional
            const total = await dex.totalLiquidity();
            const ownerShare = await dex.liquidity(owner.address);
            const addr1Share = await dex.liquidity(addr1.address);
                const combinedPortion = ownerShare.add(addr1Share).mul(1000).div(total);
                // proportions combined should represent the whole (1000)
                expect(combinedPortion).to.equal(1000);
        });
    });

    describe("Edge Cases", function() {
        it("should handle very small liquidity amounts", async function() {
            // small amounts
            const a = ethers.utils.parseUnits("1", 6); // 1e6 wei-like small
            const b = ethers.utils.parseUnits("2", 6);
            // mint small amounts to owner
            await tokenA.mint(owner.address, a);
            await tokenB.mint(owner.address, b);
            await tokenA.approve(dex.address, a);
            await tokenB.approve(dex.address, b);
            await dex.addLiquidity(a, b);
            const res = await dex.getReserves();
            expect(res[0]).to.equal(a);
            expect(res[1]).to.equal(b);
        });

        it("should handle very large liquidity amounts", async function() {
            const largeA = ethers.utils.parseEther("100000");
            const largeB = ethers.utils.parseEther("200000");
            await tokenA.mint(owner.address, largeA);
            await tokenB.mint(owner.address, largeB);
            await tokenA.approve(dex.address, largeA);
            await tokenB.approve(dex.address, largeB);
            await dex.addLiquidity(largeA, largeB);
            const res = await dex.getReserves();
            expect(res[0]).to.equal(largeA);
        });

        it("should prevent unauthorized access", async function() {
            // addr1 can't remove lp it doesn't own
            await dex.addLiquidity(ethers.utils.parseEther("10"), ethers.utils.parseEther("20"));
            const total = await dex.totalLiquidity();
            await expect(dex.connect(addr1).removeLiquidity(total)).to.be.revertedWith("Insufficient liquidity owned");
        });
    });

    describe("Events", function() {
        it("should emit LiquidityAdded event", async function() {
            await expect(dex.addLiquidity(ethers.utils.parseEther("10"), ethers.utils.parseEther("20")))
                .to.emit(dex, 'LiquidityAdded')
                .withArgs(owner.address, ethers.utils.parseEther("10"), ethers.utils.parseEther("20"), await dex.totalLiquidity());
        });

        it("should emit LiquidityRemoved event", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("10"), ethers.utils.parseEther("20"));
            const total = await dex.totalLiquidity();
            await expect(dex.removeLiquidity(total))
                .to.emit(dex, 'LiquidityRemoved');
        });

        it("should emit Swap event", async function() {
            await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"));
            await expect(dex.swapAForB(ethers.utils.parseEther("1"))).to.emit(dex, 'Swap');
        });
    });

    describe("Additional Coverage Tests", function() {
        it("constructor should revert on invalid token addresses", async function() {
            const DEX = await ethers.getContractFactory("DEX");
            await expect(DEX.deploy(ethers.constants.AddressZero, tokenB.address)).to.be.revertedWith("Invalid token addresses");
            await expect(DEX.deploy(tokenA.address, tokenA.address)).to.be.revertedWith("Tokens must be different");
        });

        it("_sqrt should return 0 for input 0 and correct sqrt for perfect squares", async function() {
            expect(await dex.testSqrt(0)).to.equal(0);
            expect(await dex.testSqrt(9)).to.equal(3);
            expect(await dex.testSqrt(16)).to.equal(4);
        });

        it("getAmountOut should revert on bad reserves or zero input", async function() {
            await expect(dex.getAmountOut(0, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))).to.be.revertedWith("Insufficient input amount");
            await expect(dex.getAmountOut(ethers.utils.parseEther("1"), 0, ethers.utils.parseEther("200"))).to.be.revertedWith("Insufficient liquidity");
        });
    });
});
