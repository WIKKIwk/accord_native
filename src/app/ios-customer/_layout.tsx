import { CustomerGate } from '../../customer/CustomerContext';
import { CustomerShell } from '../../customer/CustomerShell';
export default function CustomerLayout() { return <CustomerGate platform="ios"><CustomerShell /></CustomerGate>; }
