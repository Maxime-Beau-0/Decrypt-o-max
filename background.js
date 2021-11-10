// background.js
const fetchCoins = async () => {
  console.info('Fetching coins from coingecko api...');
  const url = "https://api.coingecko.com/api/v3/coins/list";
  try {
    const response = await fetch(url);
    const data = await response.text();
    const coins = JSON.parse(data);
    // console.info('Extension cryptoTracker : ', coins.length, 'coins found = ', coins)
    return coins;
  } catch (e) {
    console.error("Extension cryptoTracker error in fetchCoins : ", e);
    return null;
  }
};
const fetchCoin = async (coinId) => {
  console.info(`Fetching coin ${coinId} from coingecko api...`);
  // Ignore some keyword (see coingecko api specs)
  if(coinId === "list" || coinId === "markets" || coinId === "categories") {
    return null;
  }
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}`;
  try {
    const response = await fetch(url);
    const responseText = await response.text();
    const coin = JSON.parse(responseText);
    // console.info('Extension cryptoTracker : result when fetching ', coinId, ' = ', coin)
    return coin;
  } catch (e) {
    console.error("Extension cryptoTracker error in fetchCoin : ", e);
    return null;
  }
};

const fetchEthereumAddress = async (address) => {
  console.info(`Fetching address ${address} from etherscan api...`);
  const urlBalance = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`;
  // const urlTransactions = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc`;
  try {
    const response = await fetch(urlBalance);
    const responseText = await response.text();
    const data = JSON.parse(responseText);
    // console.info('Extension cryptoTracker : result when fetching ', coinId, ' = ', coin)
    if(data.status !== "1") {
      throw new Error('Etherscan api rate exceeded');
    }
    return data.result; // Data.result is the balance of this address
  } catch (e) {
    console.error("Extension cryptoTracker error in fetchCoin : ", e);
    return null;
  }
};

// Receive messages and call corresponding methods
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.topic == "coins") {
    fetchCoins().then((coins) => {
      sendResponse(coins);
    });
  }
  if (request.topic == "coin") {
    fetchCoin(request.data.coinId).then((coinInformations) => {
      sendResponse(coinInformations);
    });
  }
  if (request.topic == "ethereumAddress") {
    fetchEthereumAddress(request.data.address).then((addressInformations) => {
      sendResponse(addressInformations);
    });
  }
  return true; // Important to return true when async, see https://stackoverflow.com/a/56483156
});