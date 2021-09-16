const fetchTopic = async (topic) => {
  const topicInStorage = await getFromStorage(topic);
  return new Promise((resolve, reject) => {
    if (topicInStorage) {
      console.log("Extension : Fetched from cache - ", topicInStorage);
      return resolve(topicInStorage);
    }
    chrome.runtime.sendMessage({ topic }, (messageResponse) => {
      if (messageResponse === null || messageResponse === undefined) {
        reject(new Error(`Error fetching topic - ${topic}`));
      }
      setInStorage(topic, messageResponse);
      return resolve(messageResponse);
    });
  });
};
