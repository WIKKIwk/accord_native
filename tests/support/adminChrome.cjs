// The screen tests inspect actions supplied to the shared header.
// adminHomeViews renders the real Compose header and checks its geometry.
const AdminTopBar = ({ leading, title, actions }) => ({
  type: 'AdminTopBar',
  props: { leading, title, actions, children: [leading, title, actions] },
});
const AdminScreenHeader = ({ title, navigation, actions, profileAction, testID, standardTitle }) => ({
  type: 'AdminScreenHeader',
  props: { title, navigation, actions, profileAction, testID, standardTitle, children: [actions, profileAction] },
});

module.exports = { AdminTopBar, AdminScreenHeader };
