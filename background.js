// background.js
const fetchCoins = async () => {
  console.info('Fetching coins from coingecko api...');
  const url = "https://api.coingecko.com/api/v3/coins/list?include_platform=true";
  try {
    const response = await fetch(url);
    const data = await response.text();
    const coins = JSON.parse(data);
    // console.info('Extension decrypt-o-max : ', coins.length, 'coins found = ', coins)
    return coins;
  } catch (e) {
    console.error("Extension decrypt-o-max error in fetchCoins : ", e);
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
    // console.info('Extension decrypt-o-max : result when fetching ', coinId, ' = ', coin)
    return coin;
  } catch (e) {
    console.error("Extension decrypt-o-max, error in fetchCoin : ", e);
    return null;
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const fetchEthAddress = async (address, recursion = false) => {
  console.info(`Decrypt-o-max : Fetching address ${address} from etherscan & bscscan api...`);
  
  const urlBalanceEth = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`;
  // const urlTransactionsEth = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc`;
  const urlBalanceBsc = `https://api.bscscan.com/api?module=account&action=balance&address=${address}&tag=latest`;
  try {
    const responseEth = await fetch(urlBalanceEth)
    await sleep(250);
    const responseBsc = await fetch(urlBalanceBsc);
    // Parse responses
    const responseTextEth = await responseEth.text();
    const dataEth = JSON.parse(responseTextEth);
    const responseTextBsc = await responseBsc.text();
    const dataBsc = JSON.parse(responseTextBsc);
    console.log('dataBsc', dataBsc, 'dataEth', dataEth)
    if(dataEth.status !== "1" || dataBsc.status !== "1") {
      if(recursion) {
        throw new Error('Api rate exceeded');
      }
      console.info('Decrypt-o-max : Api rate exceeded, waiting 5 seconds before resuming...');
      await sleep(5000);
      return fetchEthAddress(address, true);
    }
    return {
      bscBalance: dataBsc.result,
      ethBalance: dataEth.result
    }
  } catch (e) {
    console.error("Extension decrypt-o-max, error in fetchAddress : ", e);
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
  if (request.topic == "ethAddress") {
    fetchEthAddress(request.data.address).then((addressInformations) => {
      sendResponse(addressInformations);
    });
  }
  return true; // Important to return true when async, see https://stackoverflow.com/a/56483156
});

const openPopup = async (selectionContext) => {
  // chrome.tabs.create({url: "https://coinmarketcap.com/fr/currencies/" + symbol});
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "display_popup", symbol: selectionContext.selectionText}).catch(e => console.error('Extension decrypt-o-max error in fetchCoins : ', e));
  });
};

chrome.contextMenus.create({
  id: "decrypt-o-max",
  title: "Informations",
  contexts:["selection", "page", "link"],
}, chrome.contextMenus.onClicked.addListener(openPopup));