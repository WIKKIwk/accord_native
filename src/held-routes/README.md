# Boyoqchi route hold

These are the existing Boyoqchi route implementations, kept outside Expo Router's
`src/app` route root while the session and Chat transport holds remain open.
They are not reachable by deep link and are not selected by `homeTarget`.
The role's other components remain in `src/boyoqchi`.

Platform suffixes keep each held route type-checked only for its own platform.
Once the integrator has explicitly cleared all release holds and reviewed the
role, restoring a route requires moving it back under its corresponding
`src/app/{ios,android}-boyoqchi/` directory and removing its `.ios` or
`.android` filename suffix. Restore the home target only together with the
complete reviewed route tree. Rerun the manifest, role, routing, session,
security and platform gates; the manifest hold test must be deliberately
updated for that separately reviewed release. This directory does not itself
change the existing Worker or Preparation routes.
