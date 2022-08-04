//protocol treats everything like ERC20 token
//ETH is not ERC20 token! but we will use WETH(wrapped ether)

const { getNamedAccounts, ethers, network } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")
const { networkConfig } = require("../helper-hardhat-config")

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()
    //abi, address for aave protocol

    const lendingPool = await getLendingPool(deployer)
    console.log(`LendingPool address  ${lendingPool.address}`)

    const wethTokenAddress = networkConfig[network.config.chainId].wethToken
    //approve
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    //deposit

    console.log("Depositing...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Deposited!")

    //how much we have borrowed, how much we have in collateral, how much we can borrow
    let { totalDebtETH, availableBorrowsETH } = await getBorrowUserData(lendingPool, deployer)
    //availableBorrowsETH?? What the conversion rate of DAI is?

    const daiPrice = await getDaiPrice()
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    console.log(`You can borrow ${amountDaiToBorrow} DAI`)
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
    // console.log(`You can borrow ${amountDaiToBorrowWei} WEI`)

    //Borrowing
    const daitTokenAddress = networkConfig[network.config.chainId].daiToken
    await borrowDai(daitTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)
    await getBorrowUserData(lendingPool, deployer)

    //Repay
    await repay(amountDaiToBorrowWei, daitTokenAddress, lendingPool, deployer)
    await getBorrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
    await approveErc20(daiAddress, lendingPool.address, amount, account) //first we have to aprove sending dai back to contract!!!
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("Repayed!")
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config.chainId].daiEthPriceFeed
    ) //reading dont need signer!
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`Dai/Eth price is ${price}`)
    return price
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrowWei, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log("You have borrowed!")
}
async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)

    console.log(`You have ${totalCollateralETH} ETH deposited!`)
    console.log(`You have ${totalDebtETH} ETH borrowed!`)
    console.log(`You can borrow ${availableBorrowsETH} ETH!`)
    return {
        availableBorrowsETH,
        totalDebtETH,
    }
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[network.config.chainId].lendingPoolAddressesProvider,
        account
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}

async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    txResponse = await erc20Token.approve(spenderAddress, amountToSpend)
    await txResponse.wait(1)
    console.log("Approved")
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
