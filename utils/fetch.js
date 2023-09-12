const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const fetchTopic = async (topic, options) => {
  // Get options
  const ttl = await getFromStorage(`${topic}_ttl`);
  const forceRefresh = options && options.forceRefresh || (!ttl || ttl <  Date.now() - CACHE_DURATION);
  const data = options && options.data ? options.data : {};

  const topicInStorage = await getFromStorage(topic);

  return new Promise((resolve, reject) => {
    if (topicInStorage && !forceRefresh) {
      console.info("Extension : Fetched from cache - ", topicInStorage);
      return resolve(topicInStorage);
    }
    console.info("Extension : Fetching topic, not using cache - topic = ", topic);
    chrome.runtime.sendMessage({ topic, data }, (messageResponse) => {
      if (messageResponse === null || messageResponse === undefined) {
        reject(new Error(`Error fetching topic - ${topic}`));
      }
      setInStorage(topic, messageResponse);
      setInStorage(`${topic}_ttl`, Date.now());
      return resolve(messageResponse);
    });
  });
};
