import { BrigaderApparatusScreen } from '../../brigader/BrigaderApparatusScreen.android';
import { appRoutes } from '../../shared/appRoutes';
export default function Page() { return <BrigaderApparatusScreen initial="groups" route={appRoutes.adminApparatusGroups} />; }
