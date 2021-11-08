const fetchTopic = async (topic, options) => {
  // Get options
  const forceRefresh = options && options.forceRefresh;
  const data = options && options.data ? options.data : {};

  const topicInStorage = await getFromStorage(topic);

  return new Promise((resolve, reject) => {
    if (topicInStorage && !forceRefresh) {
      console.info("Extension : Fetched from cache - ", topicInStorage);
      return resolve(topicInStorage);
    }
    chrome.runtime.sendMessage({ topic, data }, (messageResponse) => {
      if (messageResponse === null || messageResponse === undefined) {
        reject(new Error(`Error fetching topic - ${topic}`));
      }
      setInStorage(topic, messageResponse);
      return resolve(messageResponse);
    });
  });
};
