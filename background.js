// background.js
const fetchSymbols = async () => {
  const url = "https://api.coingecko.com/api/v3/coins/list";
  try {
    const response = await fetch(url);
    const data = await response.text();
    const coins = JSON.parse(data);
    const symbols = coins.map((coin) => coin.symbol);
    // console.info('Extension cryptoTracker : ', symbols.length, 'symbols found - ', symbols)
    return symbols;
  } catch (e) {
    console.error("Extension cryptoTracker error in fetchSymbols : ", e);
    return null;
  }
};

// Receive messages and call corresponding methods
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.topic == "symbols") {
    fetchSymbols().then((symbols) => {
      sendResponse(symbols);
    });
  }
  return true; // Important to return true when async, see https://stackoverflow.com/a/56483156
});
