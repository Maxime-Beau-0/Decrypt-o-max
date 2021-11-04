(async () => {
  /**
   * @param {*} node 
   * @returns boolean - true if node is a text element not inside a script or style tag
   */
  const isTextNode = (node) =>
  node.nodeType == Element.TEXT_NODE &&
  node.nodeName == "#text" &&
  (node.parentNode == null || 
    (node.parentNode.tagName.toLowerCase() != "script" && node.parentNode.tagName.toLowerCase() != "style"));

  const isSymbolNode = (node) => {
    return Array.from(node.classList.values()).includes("ct_symbol");
  }

    // Get all symbols & create a regexp from it
  const symbols = await fetchTopic("symbols");
  let regexpSymbols;
  try {
    regexpSymbols = new RegExp(
      `\\b(${symbols.map((coin) => coin.symbol).map(escapeRegExp).join("|")})\\b`,
      "gmi"
    );
  } catch (e) {
    // In case there is now too many tokens, take the first 9k
    regexpSymbols = new RegExp(
      `\\b(${symbols.slice(0, 9000).map((coin) => coin.symbol).map(escapeRegExp).join("|")})\\b`,
      "gmi"
    );
  }

  const injectSpanAroundText = (node, index, text) => {
    // Check that this text is not already surrounded by our injected span
    if(isSymbolNode(node.parentNode)) {
      return null;
    }
    // Create a new span element with our class & the symbolFound as attribute & text
    const newElement = document.createElement("span");
    newElement.classList = "ct_symbol";
    newElement.setAttribute('ct_symbol', text);
    newElement.setAttribute('ct_coin_id', symbols.find((coin) => coin.symbol.toLowerCase() === text.toLowerCase()).id);
    newElement.appendChild(document.createTextNode(text));
    // Remove text at this specific position - .replace() would not as it could replace another occurence of this string
    node.textContent = `${node.textContent.slice(
      0,
      index
    )}${node.textContent.slice(index + text.length)}`;
    // Insert the new span
    node.parentNode.insertBefore(newElement, node.splitText(index));
    return newElement;
  }

  /**
   * Go through a node & its children (recursively) & inject an html element around all symbols found in text nodes
   * @param {*} parentNode node to traverse
   * @returns number of symbols found
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
        continue
      }
      // Get all symbols in this node's text
      const matches = node.textContent.matchAll(regexpSymbols);
      // Iterate in reverse order (symbols at the end of the node first)
      // because we're going to split the current node on each iteration, and only keep the beginning
      for (const match of Array.from(matches).reverse()) {
        // Get useful variables
        const symbolFound = match[0];
        const index = match.index;
        const addedNode = injectSpanAroundText(node, index, symbolFound);
        if(addedNode) {
          nodesAffected.push(addedNode);
        }
      }
    }
    return nodesAffected;
  };

  // Fetch symbols and detect it in document, then format text to add a class (necessary for hover event)
  // traverseNode(document.body);
  
  /**
   * Create an empty & invisible popup, completely separated from the current page to avoid style conflicts
   */
  const boxId = "ct_popup_symbol";
  const boxSelector = `#${boxId}`;
  const createSymbolPopup = async () => {
    const box = Boundary.createBox(boxId);
    Boundary.loadBoxCSS(boxSelector, chrome.runtime.getURL("symbols/symbols.css"));
    const response = await fetch(chrome.runtime.getURL("symbols/popup.html"));
    const popupContent = await response.text();
    Boundary.rewriteBox(boxSelector, popupContent);
  }
  createSymbolPopup();

  const displayPopup = async (symbolNode) => {
    if(!isSymbolNode(symbolNode)) {
      console.warn('Trying to display popup on a non-symbol node...');
      return;
    }
    const coinId = symbolNode.getAttribute('ct_coin_id');
    const coinInformations = await fetchTopic('coin', { forceRefresh: true, data: { coinId } });
    console.info("CryptoTracker - displaying coin informations : ", coinInformations);
    $(boxSelector).appendTo($('body'));
    const $el = $(symbolNode)
    const bottom = $el.offset().top + $el.outerHeight(true);
    const right = $el.offset().left + $el.outerWidth(true);
    $(boxSelector).css({top: bottom, left: right});
    $(boxSelector).show();
  }

  const hidePopup = () => {
    $(boxSelector).hide();
  }

  // Listener on CTRL key down
  $(document).on("keydown", async (e) => {
    if(e.which == 17) {
      const hoveredNodes = document.querySelectorAll(":hover");
      const elementHovered = Array.from(hoveredNodes.values()).pop();
      // If it's a symbol node, display popup. Otherwise traverse it to add symbol nodes just in case
      if(isSymbolNode(elementHovered)) {
        displayPopup(elementHovered);
        return;
      }
      const nodesAdded = traverseNode(elementHovered);
      // Wait until nodes are added to DOM, and display popup if it's hovered
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (!mutation.addedNodes) return
          const hoveredNodes = document.querySelectorAll(":hover");
          const elementHovered = Array.from(hoveredNodes.values()).pop();
          if(isSymbolNode(elementHovered)) {
            displayPopup(elementHovered);
            return;
          }
        })
      });
      observer.observe(elementHovered, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      })
      // Stop observing after 500ms to avoid displaying a popup too late
      setTimeout(() => {
        observer.disconnect();
      }, 500);
      hidePopup();
    }
  });
})();
