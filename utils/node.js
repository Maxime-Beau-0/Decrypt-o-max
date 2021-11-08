/**
 * @param {*} node
 * @returns boolean - true if node is a text element not inside a script or style tag
 */
const isTextNode = (node) =>
  node &&
  node.nodeType == Element.TEXT_NODE &&
  node.nodeName == "#text" &&
  (node.parentNode == null ||
    (node.parentNode.tagName.toLowerCase() != "script" &&
      node.parentNode.tagName.toLowerCase() != "style"));

const isSymbolNode = (node) => {
  if (!node) return false;
  return Array.from(node.classList.values()).includes("ct_symbol");
};
