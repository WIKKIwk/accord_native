import { RoleTabs, roleTabIcons } from '../shared/navigation/RoleTabs.ios';
import { useSupplierText } from './useSupplierOverview';

export function SupplierTabs() {
  const { l } = useSupplierText();
  return <RoleTabs tabs={[
    { name: '(home)', label: l('homeNavTitle'), icon: roleTabIcons.home },
    { name: 'recent', label: l('historyNavTitle'), icon: 'clock.arrow.circlepath' },
  ]} />;
}
