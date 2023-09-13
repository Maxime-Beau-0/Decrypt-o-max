(async () => {
  // Get all coins & create regexp from it
  const coins = (await fetchTopic("coins")).filter(
    (coin) => coin.symbol !== '' && coin.name !== '' && !coin.id.startsWith("binance-peg") && coin.symbol !== "dogecoin"
  );
  let regexps = [];
  // List of names then list of symbols
  let searchTerms = coins.map((coin) => escapeRegExp(coin.name.toLowerCase()));
  searchTerms.push(...coins.map((coin) => escapeRegExp(coin.symbol.toLowerCase())));
  const uniqueSearchTerms = [...new Set(searchTerms)];
  uniqueSearchTerms.reverse(); // This reverse is important, otherwise coins like "Ethereum name service" don't work
  // Create an array of regexps from our search terms
  for (let i = 0; i < uniqueSearchTerms.length; i += 2000) {
    regexps.push(
      new RegExp(
        `\\b(${uniqueSearchTerms.slice(i, i + 2000).join("|")})\\b`,
        "gmi"
      )
    );
  }
  // Regexp for Eth & Bsc addresses & contracts
  const regexpEth = new RegExp(`\\b0x[a-fA-F0-9]{40}\\b`, 'gmi');
  
  // Create a list of contracts from our coins
  const contracts = new Map();
  for(const coin of coins) {
    if(!('platforms' in coin)) continue;
    for(const [platform, contractAddress] of Object.entries(coin.platforms)) {
      if(!contractAddress) continue;
      contracts.set(contractAddress.toLowerCase(), coin.symbol);
    }
  }
  const contractAddresses = Array.from(contracts.keys()).map(contract => contract.toLowerCase());
  const regexpsContracts = [];
  for (let i = 0; i < contractAddresses.length; i += 500) {
    regexpsContracts.push(
      new RegExp(
        `\\b(${contractAddresses.slice(i, i + 500).join("|")})\\b`,
        "gmi"
      )
    );
  }
  const shortestContractLength = contractAddresses.reduce((a, b) => a.length <= b.length ? a.length : b.length);

  /**
   * Method used to surround a "text" at "index" in "node" with a span element
   * @param {*} node
   * @param {*} index
   * @param {*} text can be a coin name or a coin symbol
   * @returns
   */
  const injectSpanAroundText = (node, index, text) => {
    // Check that this text is not already surrounded by our injected span
    if (isSymbolNode(node.parentNode)) {
      return null;
    }
    // Create a new span element with our class & the symbolFound as attribute & text
    const newElement = document.createElement("span");
    newElement.classList = "dcmax_symbol";
    newElement.setAttribute("dcmax_symbol", text);
    newElement.setAttribute(
      "dcmax_coin_id",
      coins.find(
        (coin) =>
          coin.symbol.toLowerCase() === text.toLowerCase() ||
          coin.name.toLowerCase() === text.toLowerCase()
      ).id
    );
    newElement.appendChild(document.createTextNode(text));
    // Remove text at this specific position - .replace() would not as it could replace another occurence of this string
    node.textContent = `${node.textContent.slice(
      0,
      index
    )}${node.textContent.slice(index + text.length)}`;
    // Insert the new span
    node.parentNode.insertBefore(newElement, node.splitText(index));
    return newElement;
  };

  /**
   * Method used to surround a "contractAddress" at "index" in "node" with a span element
   * @param {*} node
   * @param {*} index
   * @param {*} contractAddress
   * @returns
   */
  const injectSpanAroundContractAddress = (node, index, contractAddress) => {
    // Check that this text is not already surrounded by our injected span
    if (isSymbolNode(node.parentNode)) {
      return null;
    }
    const symbol = contracts.get(contractAddress.toLowerCase());
    if(!symbol) {
      return null;
    }
    // Create a new span element with our class & the symbolFound as attribute & text
    const newElement = document.createElement("span");
    newElement.classList = "dcmax_symbol";
    newElement.setAttribute("dcmax_symbol", symbol);
    newElement.setAttribute("dcmax_contract_address", contractAddress);
    newElement.setAttribute(
      "dcmax_coin_id",
      coins.find(
        (coin) =>
          coin.symbol.toLowerCase() === symbol.toLowerCase()
      ).id
    );
    newElement.appendChild(document.createTextNode(contractAddress));
    // Remove text at this specific position - .replace() would not as it could replace another occurence of this string
    node.textContent = `${node.textContent.slice(
      0,
      index
    )}${node.textContent.slice(index + contractAddress.length)}`;
    // Insert the new span
    node.parentNode.insertBefore(newElement, node.splitText(index));
    return newElement;
  };

  /**
   * Method used to surround an "address" at "index" in "node" with a span element
   * @param {*} node
   * @param {*} index
   * @param {*} address
   * @returns
   */
   const injectSpanAroundEthAddress = (node, index, address) => {
    // Check that this text is not already surrounded by our injected span
    if (isSymbolNode(node.parentNode)) {
      return null;
    }
    // Create a new span element with our class & the address as attribute & text
    const newElement = document.createElement("span");
    newElement.classList = "dcmax_address";
    newElement.setAttribute("dcmax_address", address);
    newElement.appendChild(document.createTextNode(address));
    // Remove text at this specific position - .replace() would not as it could replace another occurence of this string
    node.textContent = `${node.textContent.slice(
      0,
      index
    )}${node.textContent.slice(index + address.length)}`;
    // Insert the new span
    node.parentNode.insertBefore(newElement, node.splitText(index));
    return newElement;
  };

  /**
   * Go through a node & its children (recursively) & inject an html element around all coins found in text nodes
   * @param {*} parentNode node to traverse
   * @returns
   */
  const traverseNode = async (parentNode) => {
    if(!parentNode.matches(':hover')) {
      return;
    }
    for (let i = parentNode.childNodes.length - 1; i >= 0; i--) {
      const node = parentNode.childNodes[i];
      if (!isTextNode(node)) {
        if (node.nodeType == Element.ELEMENT_NODE) {
          //  Check this node's child nodes for text nodes to act on
          traverseNode(node);
        }
        continue;
      }
      if(node.textContent === "") {
        continue;
      }
      // Get all names & symbols in this node's text
      let matches = [];
      for (const regexp of regexps) {
        matches.push(...Array.from(node.textContent.matchAll(regexp)));
      }
      // Iterate in reverse order (terms at the end of the node first)
      // because we're going to split the current node on each iteration, and only keep the beginning
      matches.sort((match1, match2) =>
        match1.index > match2.index ? -1 : 1
      );

      // Remove matches "inside" other matches
      const encompassingMatches = [];
      for(const match of matches) {
        // Find a match encompassing this one. If found, do not keep this match.
        const isInsideAnotherMatch = matches.some(_match => (_match.index < match.index && _match.index + _match[0].length >= match.index + match[0].length) || (_match.index <= match.index && _match.index + _match[0].length > match.index + match[0].length));
        if(!isInsideAnotherMatch) {
          encompassingMatches.push(match);
        }
      }
      for (const match of encompassingMatches) {
        // Get useful variables
        const symbolFound = match[0];
        const index = match.index;
        injectSpanAroundText(node, index, symbolFound);
      }

      if(node.textContent.length >= 42) {
        // Get all eth addresses in this node's text
        const ethMatches = Array.from(node.textContent.matchAll(regexpEth));
        // Iterate in reverse order (terms at the end of the node first)
        // because we're going to split the current node on each iteration, and only keep the beginning
        for (const match of ethMatches.sort((match1, match2) =>
          match1.index > match2.index ? -1 : 1
        )) {
          // Get useful variables
          const addressFound = match[0];
          const index = match.index;
          // Check that this address is not a contract -> it will be handled differently
          const symbolFromContract = contracts.get(addressFound.toLowerCase());
          if(symbolFromContract) {
            continue;
          }
          injectSpanAroundEthAddress(node, index, addressFound);
        }
      }

      if(node.textContent.length >= shortestContractLength) {
        // Get all contracts in this node's text
        let contractsMatches = [];
        for (const regexp of regexpsContracts) {
          contractsMatches.push(...Array.from(node.textContent.matchAll(regexp)));
        }
        // Iterate in reverse order (terms at the end of the node first)
        // because we're going to split the current node on each iteration, and only keep the beginning
        contractsMatches.sort((match1, match2) =>
          match1.index > match2.index ? -1 : 1
        );
        // Iterate in reverse order (terms at the end of the node first)
        // because we're going to split the current node on each iteration, and only keep the beginning
        for (const match of contractsMatches) {
          // Get useful variables
          const addressFound = match[0];
          const index = match.index;
          // Check that this address is not a contract -> it will be handled differently
          injectSpanAroundContractAddress(node, index, addressFound);
        }
      }
    }
  };

  /**
   * Create an empty & invisible popup, completely separated from the current page to avoid style conflicts
   */
  const boxId = "dcmax_popup_symbol";
  const boxSelector = `#${boxId}`;
  const createSymbolPopup = async () => {
    Boundary.createBox(boxId, "dcmax-shadow");
    Boundary.loadBoxCSS(
      boxSelector,
      chrome.runtime.getURL("symbols/popup.css")
    );
    const response = await fetch(chrome.runtime.getURL("symbols/popup.html"));
    const popupContent = await response.text();
    Boundary.rewriteBox(boxSelector, popupContent);
  };
  createSymbolPopup();

  const addressBoxId = "dcmax_popup_address";
  const addressBoxSelector = `#${addressBoxId}`;
  const createAddressPopup = async () => {
    Boundary.createBox(addressBoxId, "dcmax-shadow");
    Boundary.loadBoxCSS(
      addressBoxSelector,
      chrome.runtime.getURL("addresses/popup.css")
    );
    const response = await fetch(chrome.runtime.getURL("addresses/popup.html"));
    const popupContent = await response.text();
    Boundary.rewriteBox(addressBoxSelector, popupContent);
  };
  createAddressPopup();

  const populatePopup = async (coinId) => {
    const coinInformations = await fetchTopic("coin", {
      forceRefresh: true,
      data: { coinId },
    });
    console.info(
      "Decrypt-o-max - displaying coin informations : ",
      coinId,
      coinInformations
    );
    if (!coinInformations) {
      return;
    }
    // Name & description
    Boundary.rewrite("#dcmax_coin_name", coinInformations.name);
    Boundary.find("#dcmax_coin_name").attr("title", coinInformations.name);
    Boundary.rewrite("#dcmax_coin_symbol", "(" + coinInformations.symbol + ")");
    const description = $($.parseHTML(coinInformations.description.en)).text();
    Boundary.rewrite("#dcmax_coin_description", description);
    Boundary.find("#dcmax_coin_description").attr("title", description);
    let creationDate = coinInformations.genesis_date;
    if(!creationDate) {
      creationDate = coinInformations.ico_data && coinInformations.ico_data.ico_start_date ? coinInformations.ico_data.ico_start_date.split('T')[0] : '-';
    }
    Boundary.rewrite("#dcmax_coin_creation", creationDate);
    // Price & market informations
    const currentPrice = coinInformations.market_data.current_price.usd;
    Boundary.rewrite(
      "#dcmax_coin_current_price",
      formatToUsd(currentPrice)
    );
    Boundary.rewrite(
      "#dcmax_coin_change_24h",
      formatToUsPercent(
        coinInformations.market_data.price_change_percentage_24h
      )
    );
    Boundary.find("#dcmax_coin_change_24h").css(
      "color",
      coinInformations.market_data.price_change_percentage_24h > 0
        ? "#7ab52b"
        : "#f44336"
    );
    Boundary.rewrite(
      "#dcmax_coin_rank",
      coinInformations.market_data.market_cap_rank ? formatToUsNumber(coinInformations.market_data.market_cap_rank) : coinInformations.coingecko_rank ? formatToUsNumber(coinInformations.coingecko_rank) : '-'
    );
    Boundary.rewrite(
      "#dcmax_coin_marketcap",
      formatToUsd(coinInformations.market_data.market_cap.usd)
    );
    Boundary.rewrite(
      "#dcmax_coin_ath",
      formatToUsd(coinInformations.market_data.ath.usd)
    );
    const changeAth = getPercentageChange(coinInformations.market_data.ath.usd, currentPrice) * -1;
    Boundary.rewrite(
      "#dcmax_coin_change_ath",
      formatToUsPercent(changeAth)
    );
    Boundary.find("#dcmax_coin_change_ath").css(
      "color", "#f44336"
    );
    Boundary.rewrite(
      "#dcmax_coin_atl",
      formatToUsd(coinInformations.market_data.atl.usd)
    );
    const changeAtl = getPercentageChange(coinInformations.market_data.atl.usd, currentPrice) * -1;
    Boundary.rewrite(
      "#dcmax_coin_change_atl",
      formatToUsPercent(changeAtl)
    );
    Boundary.find("#dcmax_coin_change_atl").css(
      "color", "#7ab52b"
    );
    Boundary.rewrite(
      "#dcmax_coin_24h_volume",
      formatToUsd(coinInformations.market_data.total_volume.usd)
    );
    Boundary.rewrite(
      "#dcmax_coin_current_supply",
      coinInformations.market_data.circulating_supply
        ? formatToUsNumber(coinInformations.market_data.circulating_supply)
        : "-"
    );
    Boundary.rewrite(
      "#dcmax_coin_max_supply",
      coinInformations.market_data.total_supply ||
        coinInformations.market_data.max_supply
        ? formatToUsNumber(
            coinInformations.market_data.total_supply ||
              coinInformations.market_data.max_supply
          )
        : "-"
    );
    // Links & social media
    const homepage =
      coinInformations.links.homepage.length > 0
        ? coinInformations.links.homepage[0]
        : null;
    if (homepage) {
      Boundary.find("#dcmax_link_homepage").attr("href", homepage).show();
      Boundary.find("#dcmax_logo_homepage")
        .attr("src", chrome.runtime.getURL("images/icons/laptop-house.svg"))
        .show();
    }
    else Boundary.find("#dcmax_link_homepage").hide();

    const subreddit = coinInformations.links.subreddit_url || null;
    if (subreddit && subreddit !== "https://www.reddit.com") {
      Boundary.find("#dcmax_link_reddit").attr("href", subreddit).show();
      Boundary.find("#dcmax_logo_reddit")
        .attr("src", chrome.runtime.getURL("images/icons/reddit-alien.svg"))
        .show();
    }
    else Boundary.find("#dcmax_link_reddit").hide();

    const twitterHandle = coinInformations.links.twitter_screen_name || null;
    if (twitterHandle) {
      Boundary.find("#dcmax_link_twitter")
        .attr("href", "https://twitter.com/" + twitterHandle)
        .show();
      Boundary.find("#dcmax_logo_twitter")
        .attr("src", chrome.runtime.getURL("images/icons/twitter.svg"))
        .show();
    }
    else Boundary.find("#dcmax_link_twitter").hide();

    const facebookUsername = coinInformations.links.facebook_username || null;
    if (facebookUsername) {
      Boundary.find("#dcmax_link_facebook")
        .attr("href", "https://facebook.com/" + facebookUsername)
        .show();
      Boundary.find("#dcmax_logo_facebook")
        .attr("src", chrome.runtime.getURL("images/icons/facebook-f.svg"))
        .show();
    }
    else Boundary.find("#dcmax_link_facebook").hide();

    const telegramIdentifier =
      coinInformations.links.telegram_channel_identifier || null;
    if (telegramIdentifier) {
      Boundary.find("#dcmax_link_telegram")
        .attr("href", "https://t.me/" + telegramIdentifier)
        .show();
      Boundary.find("#dcmax_logo_telegram")
        .attr("src", chrome.runtime.getURL("images/icons/telegram-plane.svg"))
        .show();
    }
    else Boundary.find("#dcmax_link_telegram").hide();

    const github =
      coinInformations.links.repos_url.github.length > 0
        ? coinInformations.links.repos_url.github[0]
        : null;
    if (github) {
      Boundary.find("#dcmax_link_github").attr("href", github).show();
      Boundary.find("#dcmax_logo_github")
        .attr("src", chrome.runtime.getURL("images/icons/github.svg"))
        .show();
    }
    else Boundary.find("#dcmax_link_github").hide();

    Boundary.find("#dcmax_link_coinmarketcap")
      .attr(
        "href",
        "https://coinmarketcap.com/currencies/" + coinInformations.id
      )
      .show();
    Boundary.find("#dcmax_link_coingecko")
      .attr("href", "https://www.coingecko.com/en/coins/" + coinInformations.id)
      .show();
    Boundary.find("#dcmax_logo_coingecko")
      .attr("src", chrome.runtime.getURL("images/icons/coingecko_logo.png"))
      .show();
    const explorer =
      coinInformations.links.blockchain_site.length > 0
        ? coinInformations.links.blockchain_site.find(
            (link) =>
              link.includes("etherscan.io") || link.includes("bscscan.com")
          ) || coinInformations.links.blockchain_site[0]
        : null;
    if (explorer) {
      Boundary.find("#dcmax_link_explorer").attr("href", explorer).show();
      Boundary.find("#dcmax_logo_explorer")
        .attr("src", chrome.runtime.getURL("images/icons/list-alt.svg"))
        .show();
    }
    else Boundary.find("#dcmax_link_explorer").hide();
    // Logo & images
    if (coinInformations.image.small) {
      const logo = Boundary.find("#dcmax_coin_logo");
      logo.attr("src", coinInformations.image.small);
    }
    const image = Boundary.find("#dcmax_market");
    image.css(
      "background-image",
      "url(" + chrome.runtime.getURL("images/splash.jpg") + ")"
    );

    $('body').on("click", hidePopup);
    return true;
  };

  const populateEthAddressPopup = async (address) => {
    const addressInformations = await fetchTopic("ethAddress", {
      forceRefresh: true,
      data: { address },
    });
    console.info(
      "Decrypt-o-max - displaying address informations : ",
      address,
      addressInformations
    );
    if (!addressInformations) {
      return;
    }
    // Balance & transactions
    Boundary.rewrite(
      "#dcmax_address",
      address
    );
    Boundary.rewrite(
      "#dcmax_address_eth_balance",
      `${formatToUsNumber(addressInformations.ethBalance * 0.000000000000000001, 6)} ETH`
    );
    Boundary.rewrite(
      "#dcmax_address_bsc_balance",
      `${formatToUsNumber(addressInformations.bscBalance * 0.000000000000000001, 6)} BNB`
    );
    // Links, logos & social media
    Boundary.find("#dcmax_logo_eth").attr("src", chrome.runtime.getURL("images/icons/eth-diamond-purple.png")).show();
    Boundary.find("#dcmax_logo_bnb").attr("src", chrome.runtime.getURL("images/icons/binance-coin-bnb-logo.png")).show();
    Boundary.find("#dcmax_link_etherscan").attr("href", `https://etherscan.io/address/${address}`).show();
    Boundary.find("#dcmax_link_bscscan").attr("href", `https://bscscan.com/address/${address}`).show();

    $('body').on("click", hidePopup);
    return true;
  };

  
  const display = async () => {
    const hoveredNodes = contextMenuInformations?.hoveredNodes || document.querySelectorAll(":hover");
    const elementHovered = Array.from(hoveredNodes.values()).pop();
    // If it's a symbol node, display popup. Otherwise traverse it to add symbol nodes just in case
    if (isSymbolNode(elementHovered)) {
      displayCoinPopup(elementHovered);
      contextMenuInformations = null;
      return;
    }
    if (isAddressNode(elementHovered)) {
      displayAddressPopup(elementHovered);
      contextMenuInformations = null;
      return;
    }
    displayLoadingCursor(elementHovered);
    // Traverse node & wait until nodes are added to DOM, and display popup if it's hovered (or we right clicked on it)
    const observer = new MutationObserver(((contextMenuInformations) => (mutations) => {
      for (const mutation of mutations) {
        if (!mutation.addedNodes) continue;
        // .querySelectorAll with hover would not be refreshed yet & no event can be catch, wait 10ms... no other solution found
        setTimeout(() => {
          const hoveredNodes = contextMenuInformations ? document.elementsFromPoint(contextMenuInformations.x, contextMenuInformations.y).reverse() : document.querySelectorAll(":hover");
          const elementHovered = Array.from(hoveredNodes.values()).pop();
          if (isSymbolNode(elementHovered)) {
            displayCoinPopup(elementHovered);
          }
          if (isAddressNode(elementHovered)) {
            displayAddressPopup(elementHovered);
          }
        }, 10);
        break;
      }
      hideLoadingCursor(elementHovered);
    })(contextMenuInformations));
    observer.observe(elementHovered, {
      childList: true,
      subtree: true,
      attributes: false,
    });
    traverseNode(elementHovered);
    // Stop observing after 500ms to avoid displaying a popup too late
    setTimeout(() => {
      observer.disconnect();
      hideLoadingCursor(elementHovered);
    }, 500);
    contextMenuInformations = null;
  }

  const displayCoinPopup = async (symbolNode) => {
    if (!isSymbolNode(symbolNode)) {
      console.warn("Trying to display popup on a non-symbol node...");
      return;
    }
    // Display loading
    displayLoadingCursor(symbolNode);
    // Get coin id and populate popup based on these informations
    const coinId = symbolNode.getAttribute("dcmax_coin_id");
    // Move it to the right location (bottom-right of the current node)
    const $el = $(symbolNode);
    const bottom = Math.min(
      $el.offset().top + $el.outerHeight(true),
      $(window).scrollTop() + document.documentElement.clientHeight - 350
    );
    const right = Math.min(
      $el.offset().left + $el.outerWidth(true),
      $(window).scrollLeft() + document.documentElement.clientWidth - 700
    );
    $(boxSelector).css({ top: bottom, left: right });
    await populatePopup(coinId);
    // Once everything is over, we can safely display popup
    hideLoadingCursor(symbolNode);
    $(boxSelector).show();
  };

  const displayAddressPopup = async (symbolNode) => {
    if (!isAddressNode(symbolNode)) {
      console.warn("Trying to display popup on a non-address node...");
      return;
    }
    // Display loading
    displayLoadingCursor(symbolNode);
    // Get coin id and populate popup based on these informations
    const address = symbolNode.getAttribute("dcmax_address");
    // Move it to the right location (bottom-right of the current node)
    const $el = $(symbolNode);
    const bottom = Math.min(
      $el.offset().top + $el.outerHeight(true),
      $(window).scrollTop() + document.documentElement.clientHeight - 150
    );
    const right = Math.min(
      $el.offset().left + $el.outerWidth(true),
      $(window).scrollLeft() + document.documentElement.clientWidth - 350
    );
    $(addressBoxSelector).css({ top: bottom, left: right });
    await populateEthAddressPopup(address);
    // Once everything is over, we can safely display popup
    hideLoadingCursor(symbolNode);
    $(addressBoxSelector).show();
  };

  const hidePopup = () => {
    $(boxSelector).hide();
    $(addressBoxSelector).hide();
  };

  // Listener on CTRL key down to display popup, ESC to hide it
  $(document).on("keydown", async (e) => {
    if (e.which == 27) {
      hidePopup();
    } else if (e.which == 104 || e.which == 72) {
      hidePopup();
      display();
    }
  });

  /**
   * Right click methods, used when a user open the context menu and click on our link
   * We need to save x & y position of the mouse to re-compute hovered element after we populate the DOM
   */
  let contextMenuInformations = null;
  $(document).on("contextmenu", async (e) => {
    contextMenuInformations = {
      hoveredNodes: document.elementsFromPoint(e.clientX, e.clientY).reverse(),
      target: e.target,
      x: e.clientX,
      y: e.clientY
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if(message.action === "display_popup") {
      hidePopup();
      display();
    }
  });
})();