const getFromStorage = async (key) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (value) => {
      if (value === null || value === undefined) {
        resolve(null);
      }
      resolve(value[key]);
    });
  });
};

const setInStorage = async (key, value) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
};
