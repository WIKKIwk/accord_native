# Shared role drawer

`src/shared/navigation/RoleDrawer.ios.tsx` and `RoleDrawer.android.tsx` are the native shells extracted from the existing worker drawer. There is no role, session, capability or route knowledge inside either shell.

## Using it for another role

Import `RoleDrawer` without a platform suffix. Import `useRoleDrawerState` from `src/shared/navigation/roleDrawerContext.ts` and spread its controlled state into the component. Wrap the role's existing navigator, so the drawer also covers its native header and tabs.

```tsx
const drawer = useRoleDrawerState();
return <RoleDrawer {...drawer}
  title={title}
  items={destinations}
  active={selectedDestinationId}
  onSelect={selectDestination}
  closeAccessibilityLabel={closeLabel}
  footerAction={logoutAction}>
  {navigator}
</RoleDrawer>;
```

- `items`: an ordered list of `{ id, label, symbol?, supportingText?, disabled? }`. Each role filters by its capabilities and translates its labels before passing this list. An icon can supply `{ ios, android }` names.
- `active`: the selected destination ID. Tapping it only closes the drawer. A disabled entry neither closes nor navigates.
- `onSelect`: a role-owned callback, invoked after requesting closure. It chooses push, root replacement, tab selection, or another operation. The shell never chooses a route.
- `footerAction`: optional item with an optional `destructive` colour treatment. It uses the same callback and disabled rules. No logout button is added implicitly.
- Descendant controls use `useRoleDrawer().open()` / `.close()`. Native iOS headers can use `RoleDrawerButton` with a translated accessibility label. Existing headers can call the hook directly.
- `confirmRoleDrawerLogout(callback)` supplies V2's localized logout confirmation. It does not know how a role ends its session.

## Existing consumers

- Both native `WorkerDrawer` adapters retain the original props used by `WorkerScreen` and the native worker layout. Their item configuration lives in `components/workerDrawerModel.ts`.
- Both `PreparationDrawer` adapters supply the role's V2 destinations and capability checks. `preparationDrawerModel.ts` holds the common order, icons, active IDs and platform route mappings.
- The iOS preparation root wraps `NativeTabs`; its home stack uses the shared hamburger button instead of `PreparationMenu`.
- Android preparation wraps its stack once; `PreparationPage` opens that drawer through the shared context instead of owning a second drawer.

V2 references: `core/widgets/navigation/role_navigation_drawer.dart`, `features/preparation/presentation/preparation_navigation.dart`, `core/widgets/feedback/logout_prompt.dart`.
