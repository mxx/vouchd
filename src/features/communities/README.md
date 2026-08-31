# features/communities/

Which relay this app is pointed at. A relay URL *is* a community in Buzz's
model, so `CommunityPanel.tsx` is the closest thing here to a workspace
picker. The URL is remembered in localStorage; nothing secret is.
