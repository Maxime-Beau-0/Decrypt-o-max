(async () => {
  const isTextNode = (node) =>
    node.nodeType == Element.TEXT_NODE &&
    node.nodeName == "#text" &&
    (node.parentNode == null ||
      (node.parentNode.tagName.toLowerCase() != "script" &&
        node.parentNode.tagName.toLowerCase() != "style"));

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

  const replaceTextInNode = (parentNode) => {
    for (let i = parentNode.childNodes.length - 1; i >= 0; i--) {
      const node = parentNode.childNodes[i];
      //  Make sure this is a text node
      if (isTextNode(node)) {
        // Get all symbols in this node's text
        const matches = node.textContent.matchAll(regexpSymbols);
        // Iterate in reverse order (symbols at the end of the node first)
        // because we're going to split the current node on each iteration, and only keep the beginning
        for (const match of Array.from(matches).reverse()) {
          // Get useful variables
          const symbolFound = match[0];
          const index = match.index;

          // Create a new span element with our class & the symbolFound as attribute & text
          const newElement = document.createElement("span");
          newElement.classList = "ct_symbol";
          newElement.setAttribute('ct_symbol', symbolFound);
          newElement.setAttribute('ct_coin_id', symbols.find((coin) => coin.symbol.toLowerCase() === symbolFound.toLowerCase()).id);
          newElement.appendChild(document.createTextNode(symbolFound));
          // Remove text at this specific position - .replace() would not as it could replace another occurence of this string
          node.textContent = `${node.textContent.slice(
            0,
            index
          )}${node.textContent.slice(index + symbolFound.length)}`;
          // Insert the new span
          node.parentNode.insertBefore(newElement, node.splitText(index));
        }
      } else if (node.nodeType == Element.ELEMENT_NODE) {
        //  Check this node's child nodes for text nodes to act on
        replaceTextInNode(node);
      }
    }
  };

  // Fetch symbols and detect it in document, then format text to add a class (necessary for hover event)
  replaceTextInNode(document.body);
  
  const boxId = "ct_popup_symbol";
  const boxSelector = `#${boxId}`;
  const box = Boundary.createBox(boxId);
  Boundary.loadBoxCSS(boxSelector, chrome.runtime.getURL("symbols/symbols.css"));
  const response = await fetch(chrome.runtime.getURL("symbols/popup.html"));
  const popupContent = await response.text();
  Boundary.rewriteBox(boxSelector, popupContent);
  $(".ct_symbol").on("mouseover", async (event) => {
      const symbolElement = event.target;
      const coinId = symbolElement.getAttribute('ct_coin_id');
      const coinInformations = await fetchTopic('coin', { forceRefresh: true, data: { coinId } });
      console.log("🚀 ~ file: symbols.js ~ line 73 ~ $ ~ coinInformations", coinInformations);
      $(boxSelector).appendTo(event.target);
      $(boxSelector).show();
  }).on("mouseout", function() {
      $(boxSelector).hide();
  });
})();
