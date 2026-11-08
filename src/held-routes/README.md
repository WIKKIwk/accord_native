# Boyoqchi Chat hold

The Boyoqchi Chat route implementations stay outside Expo Router's `src/app`
root while the shared Chat transport has an unresolved credential/redirect
security issue. Boyoqchi Home, Astatka and Profile may be routed separately;
Chat is absent from their dock and drawer and cannot be opened by deep link.
The existing Worker and Preparation Chat paths are unchanged.

Platform suffixes keep these held files type-checked for their own platform.
After the integrator verifies a safe transport and approves release, restoring
Chat requires moving these files into the corresponding platform's Chat route
folder under `src/app`, removing their `.ios` or `.android` suffixes, and
restoring the role's Chat destinations. Run the manifest, lifecycle, transport,
security, navigation and platform gates before release. Do not fabricate an
unread count or a destination while this hold remains.
