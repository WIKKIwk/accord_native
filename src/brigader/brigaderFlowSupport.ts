import { appRoutes } from '../shared/appRoutes';
/** Routes with actual argument-bearing native compositions in BrigaderFlowRoute. */
export const brigaderFlowSupport: ReadonlySet<string> = new Set([appRoutes.adminItemCreate, appRoutes.adminItemBulkMove, appRoutes.adminItemDetail, appRoutes.adminUserCreate]);
