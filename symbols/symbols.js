(async () => {
  /***************************
   * START OF UTILITY METHODS
   **************************/

  const displayLoadingCursor = (node) => {
    $("body").addClass("ct_waiting");
    if (node) $(node).addClass("ct_waiting");
  };

  const hideLoadingCursor = (node) => {
    $("body").removeClass("ct_waiting");
    if (node) $(node).removeClass("ct_waiting");
  };

  /*************************
   * END OF UTILITY METHODS
   ************************/

  // Get all coins & create regexp from it
  const coins = (await fetchTopic("coins")).filter(
    (coin) => !coin.id.startsWith("binance-peg")
  );
  const regexps = [];
  // List of names then list of symbols
  let searchTerms = coins.map((coin) => coin.name.toLowerCase()).map(escapeRegExp);
  searchTerms.push(...coins.map((coin) => coin.symbol.toLowerCase()).map(escapeRegExp));
  const uniqueSearchTerms = [...new Set(searchTerms)];
  // Create an array of regexps from our search terms
  for (let i = 0; i < uniqueSearchTerms.length; i += 2000) {
    regexps.push(
      new RegExp(
        `\\b(${uniqueSearchTerms.slice(i, i + 2000).join("|")})\\b`,
        "gmi"
      )
    );
  }

  /**
   * Method used to surround a "text" at "index" in "node" with a span element
   * @param {*} node
   * @param {*} index
   * @param {*} text
   * @returns
   */
  const injectSpanAroundText = (node, index, text) => {
    // Check that this text is not already surrounded by our injected span
    if (isSymbolNode(node.parentNode)) {
      return null;
    }
    // Create a new span element with our class & the symbolFound as attribute & text
    const newElement = document.createElement("span");
    newElement.classList = "ct_symbol";
    newElement.setAttribute("ct_symbol", text);
    newElement.setAttribute(
      "ct_coin_id",
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
   * Go through a node & its children (recursively) & inject an html element around all coins found in text nodes
   * @param {*} parentNode node to traverse
   * @returns number of coins found
   */
  const traverseNode = (parentNode) => {
    let nodesAffected = [];
    for (let i = parentNode.childNodes.length - 1; i >= 0; i--) {
      const node = parentNode.childNodes[i];
      if (!isTextNode(node)) {
        if (node.nodeType == Element.ELEMENT_NODE) {
          //  Check this node's child nodes for text nodes to act on
          nodesAffected.push(...traverseNode(node));
        }
        continue;
      }
      // Get all names & symbols in this node's text
      const matches = [];
      for (const regexp of regexps) {
        matches.push(...Array.from(node.textContent.matchAll(regexp)));
      }
      // Iterate in reverse order (terms at the end of the node first)
      // because we're going to split the current node on each iteration, and only keep the beginning
      for (const match of matches.sort((match1, match2) =>
        match1.index > match2.index ? -1 : 1
      )) {
        // Get useful variables
        const symbolFound = match[0];
        const index = match.index;
        const addedNode = injectSpanAroundText(node, index, symbolFound);
        if (addedNode) {
          nodesAffected.push(addedNode);
        }
      }
    }
    return nodesAffected;
  };

  /**
   * Create an empty & invisible popup, completely separated from the current page to avoid style conflicts
   */
  const boxId = "ct_popup_symbol";
  const boxSelector = `#${boxId}`;
  const createSymbolPopup = async () => {
    const box = Boundary.createBox(boxId, "shadow");
    Boundary.loadBoxCSS(
      boxSelector,
      chrome.runtime.getURL("symbols/popup.css")
    );
    const response = await fetch(chrome.runtime.getURL("symbols/popup.html"));
    const popupContent = await response.text();
    Boundary.rewriteBox(boxSelector, popupContent);
  };
  createSymbolPopup();

  const populatePopup = async (coinId) => {
    const coinInformations = await fetchTopic("coin", {
      forceRefresh: true,
      data: { coinId },
    });
    console.info(
      "CryptoTracker - displaying coin informations : ",
      coinId,
      coinInformations
    );
    if (!coinInformations) {
      return;
    }
    // Name & description
    Boundary.rewrite("#ct_coin_name", coinInformations.name);
    Boundary.rewrite("#ct_coin_symbol", "(" + coinInformations.symbol + ")");
    const description = $($.parseHTML(coinInformations.description.en)).text();
    Boundary.rewrite("#ct_coin_description", description);
    Boundary.find("#ct_coin_description").attr("title", description);
    // Price & market informations
    Boundary.rewrite(
      "#ct_coin_current_price",
      formatToUsd(coinInformations.market_data.current_price.usd)
    );
    Boundary.rewrite(
      "#ct_coin_change_24h",
      formatToUsPercent(
        coinInformations.market_data.price_change_percentage_24h
      )
    );
    Boundary.find("#ct_coin_change_24h").css(
      "color",
      coinInformations.market_data.price_change_percentage_24h > 0
        ? "#7ab52b"
        : "#f44336"
    );
    Boundary.rewrite(
      "#ct_coin_marketcap",
      formatToUsd(coinInformations.market_data.market_cap.usd)
    );
    Boundary.rewrite(
      "#ct_coin_ath",
      formatToUsd(coinInformations.market_data.ath.usd)
    );
    Boundary.rewrite(
      "#ct_coin_atl",
      formatToUsd(coinInformations.market_data.atl.usd)
    );
    Boundary.rewrite(
      "#ct_coin_24h_volume",
      formatToUsd(coinInformations.market_data.total_volume.usd)
    );
    Boundary.rewrite(
      "#ct_coin_current_supply",
      coinInformations.market_data.circulating_supply
        ? formatToUsNumber(coinInformations.market_data.circulating_supply)
        : "-"
    );
    Boundary.rewrite(
      "#ct_coin_max_supply",
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
    if (homepage)
      Boundary.find("#ct_link_homepage").attr("href", homepage).show();
    else Boundary.find("#ct_link_homepage").hide();
    const subreddit = coinInformations.links.subreddit_url || null;
    if (subreddit)
      Boundary.find("#ct_link_reddit").attr("href", subreddit).show();
    else Boundary.find("#ct_link_reddit").hide();
    const twitterHandle = coinInformations.links.twitter_screen_name || null;
    if (twitterHandle)
      Boundary.find("#ct_link_twitter")
        .attr("href", "https://twitter.com/" + twitterHandle)
        .show();
    else Boundary.find("#ct_link_twitter").hide();
    const facebookUsername = coinInformations.links.facebook_username || null;
    if (facebookUsername)
      Boundary.find("#ct_link_facebook")
        .attr("href", "https://facebook.com/" + facebookUsername)
        .show();
    else Boundary.find("#ct_link_facebook").hide();
    const telegramIdentifier =
      coinInformations.links.telegram_channel_identifier || null;
    if (telegramIdentifier)
      Boundary.find("#ct_link_telegram")
        .attr("href", "https://t.me/" + telegramIdentifier)
        .show();
    else Boundary.find("#ct_link_telegram").hide();
    const github =
      coinInformations.links.repos_url.github.length > 0
        ? coinInformations.links.repos_url.github[0]
        : null;
    if (github) Boundary.find("#ct_link_github").attr("href", github).show();
    else Boundary.find("#ct_link_github").hide();
    Boundary.find("#ct_link_coinmarketcap")
      .attr(
        "href",
        "https://coinmarketcap.com/currencies/" + coinInformations.id
      )
      .show();
    Boundary.find("#ct_link_coingecko")
      .attr("href", "https://www.coingecko.com/en/coins/" + coinInformations.id)
      .show();
    Boundary.find("#ct_logo_coingecko")
      .attr("src", chrome.runtime.getURL("images/coingecko_logo.png"))
      .show();
    const explorer =
      coinInformations.links.blockchain_site.length > 0
        ? coinInformations.links.blockchain_site.find(
            (link) =>
              link.includes("etherscan.io") || link.includes("bscscan.com")
          ) || coinInformations.links.blockchain_site[0]
        : null;
    if (explorer)
      Boundary.find("#ct_link_explorer").attr("href", explorer).show();
    else Boundary.find("#ct_link_explorer").hide();
    // Logo & images
    if (coinInformations.image.small) {
      const logo = Boundary.find("#ct_coin_logo");
      logo.attr("src", coinInformations.image.small);
    }
    const image = Boundary.find("#ct_market");
    image.css(
      "background-image",
      "url(" + chrome.runtime.getURL("images/splash.jpg") + ")"
    );
    return true;
  };

  const displayPopup = async (symbolNode) => {
    if (!isSymbolNode(symbolNode)) {
      console.warn("Trying to display popup on a non-symbol node...");
      return;
    }
    // Display loading
    displayLoadingCursor(symbolNode);
    // Get coin id and populate popup based on these informations
    const coinId = symbolNode.getAttribute("ct_coin_id");
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

  const hidePopup = () => {
    $(boxSelector).hide();
  };

  // Listener on CTRL key down to display popup, ESC to hide it
  $(document).on("keydown", async (e) => {
    if (e.which == 27) {
      hidePopup();
    } else if (e.which == 17) {
      hidePopup();
      const hoveredNodes = document.querySelectorAll(":hover");
      const elementHovered = Array.from(hoveredNodes.values()).pop();
      // If it's a symbol node, display popup. Otherwise traverse it to add symbol nodes just in case
      if (isSymbolNode(elementHovered)) {
        displayPopup(elementHovered);
        return;
      }
      displayLoadingCursor(elementHovered);
      // Traverse node & wait until nodes are added to DOM, and display popup if it's hovered
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (!mutation.addedNodes) continue;
          // .querySelectorAll with hover would not be refreshed yet & no event can be catch, wait 10ms... no other solution found
          setTimeout(() => {
            const hoveredNodes = document.querySelectorAll(":hover");
            const elementHovered = Array.from(hoveredNodes.values()).pop();
            if (isSymbolNode(elementHovered)) {
              displayPopup(elementHovered);
            }
          }, 10);
          break;
        }
        hideLoadingCursor(elementHovered);
      });
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
    }
  });
})();
