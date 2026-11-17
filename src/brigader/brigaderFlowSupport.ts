import { appRoutes } from '../shared/appRoutes';
/** Routes with actual argument-bearing native compositions in BrigaderFlowRoute. */
export const brigaderFlowSupport: ReadonlySet<string> = new Set([appRoutes.adminRawMaterialSettings,appRoutes.adminRawMaterialRules,appRoutes.adminRawMaterialAssignments,appRoutes.apparatusPaddonDetail,appRoutes.apparatusPaddons,appRoutes.apparatusQueue,appRoutes.adminApparatusSettings, appRoutes.adminItemCreate, appRoutes.adminItemBulkMove, appRoutes.adminItemDetail, appRoutes.adminUserCreate]);
