(async () => {
  const isTextNode = (node) =>
    node.nodeType == Element.TEXT_NODE &&
    node.nodeName == "#text" &&
    (node.parentNode == null ||
      (node.parentNode.tagName != "SCRIPT" &&
        node.parentNode.tagName != "STYLE"));

  const symbols = await fetchTopic("symbols");
  let regexpSymbols;
  try {
    regexpSymbols = new RegExp(
      `\\b(${symbols.map(escapeRegExp).join("|")})\\b`,
      "gmi"
    );
  } catch (e) {
    // In case there is now too many tokens, take the first 9k
    regexpSymbols = new RegExp(
      `\\b(${symbols.slice(0, 9000).map(escapeRegExp).join("|")})\\b`,
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
          const textFound = match[0];
          const index = match.index;

          // Create a new span element with our class and the textFound (and put it where the text was)
          const newElement = document.createElement("span");
          newElement.classList = "ct_coin";
          newElement.appendChild(document.createTextNode(textFound));
          // Remove text at this specific position - .replace() would not as it could replace another occurence of this string
          node.textContent = `${node.textContent.slice(
            0,
            index
          )}${node.textContent.slice(index + textFound.length)}`;
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
  // Insert popup
  fetch(chrome.runtime.getURL("/symbols/popup.html"))
    .then((response) => response.text())
    .then((html) => {
      document.body.insertAdjacentHTML('beforeend', html);
    })
    .catch((error) => {
      console.error('Extension : Error trying to fetch / parse popup.html', error)
    });
})();
