import type { Session,SessionWitness } from '../auth';
import type { CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
export type BrigaderCalculateOrderRowProps={template:CalculateOrderTemplate;index:number;count:number;session:Session;witness:SessionWitness;current:()=>boolean;interactive:()=>boolean;locale:string;onPress:()=>void;onDelete:()=>void};
