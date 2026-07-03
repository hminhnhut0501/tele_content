window.contentHubController = function () {
  return Object.assign(
    {},
    window.createContentHubState(),
    window.createContentHubHelpers(),
    window.createContentHubLifecycle(),
    window.createContentHubGroups(),
    window.createContentHubTopics(),
    window.createContentHubCampaigns(),
  );
};
