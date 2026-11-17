import { BrigaderApparatusScreen } from '../../brigader/BrigaderApparatusScreen.ios';
import { appRoutes } from '../../shared/appRoutes';
export default function Page() { return <BrigaderApparatusScreen initial="groups" route={appRoutes.adminApparatusGroups} />; }
