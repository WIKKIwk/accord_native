import { NativeTabs, type SFSymbolIcon } from 'expo-router/native-tabs';

export const roleTabIcons = {
  home: { default: 'house', selected: 'house.fill' },
  profile: { default: 'person', selected: 'person.fill' },
  chat: { default: 'bubble.left', selected: 'bubble.left.fill' },
} as const;

type Tab = {
  name: string;
  label: string;
  icon: NonNullable<SFSymbolIcon['sf']>;
  hidden?: boolean;
  showBadge?: boolean;
};

export function RoleTabs({ tabs, hidden, disableHiddenAnimation }: {
  tabs: readonly Tab[];
  hidden?: boolean;
  disableHiddenAnimation?: boolean;
}) {
  return <NativeTabs hidden={hidden} disableHiddenAnimation={disableHiddenAnimation}>
    {tabs.map(tab => <NativeTabs.Trigger key={tab.name} name={tab.name} hidden={tab.hidden}>
      <NativeTabs.Trigger.Icon sf={tab.icon} />
      <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
      {tab.showBadge === undefined ? null : <NativeTabs.Trigger.Badge hidden={!tab.showBadge} />}
    </NativeTabs.Trigger>)}
  </NativeTabs>;
}
