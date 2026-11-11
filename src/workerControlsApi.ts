import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';

type JsonObject = Record<string, unknown>;
type WorkerControlErrorDetails = { apparatusOptions?: readonly string[]; details?: readonly string[];
  activeKadrCount?: number | null; scannedKadrCount?: number | null; orderTitle?: string };

export class WorkerControlException extends Error {
  readonly apparatusOptions: readonly string[];
  readonly details: readonly string[];
  readonly activeKadrCount: number | null;
  readonly scannedKadrCount: number | null;
  readonly orderTitle: string;
  constructor(readonly code: string, message: string, readonly statusCode?: number,
    readonly diagnostics: JsonObject = {}, readonly requestId?: string | null, fields: WorkerControlErrorDetails = {}) {
    super(message);
    this.name = 'MobileApiException';
    this.apparatusOptions = fields.apparatusOptions ?? []; this.details = fields.details ?? [];
    this.activeKadrCount = fields.activeKadrCount ?? null; this.scannedKadrCount = fields.scannedKadrCount ?? null;
    this.orderTitle = fields.orderTitle ?? errorText(diagnostics.order_title);
  }
  toString(): string { return this.message; }
}

const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;
const hexToken = (value: string) => /^[a-fA-F0-9]{64}$/.test(value);
const operator = (role: unknown) => role === 'aparatchi' || role === 'rezka_master';

/** @v2 isCanonicalApparatusId */
export function isCanonicalApparatusId(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || normalized !== normalized.toLowerCase() || /\s/.test(normalized)) return false;
  const parts = normalized.split(':');
  return parts.length >= 3 && parts[0] === 'apparatus' && parts.slice(1).every(Boolean);
}

function requireApparatus(value: string): string {
  if (!isCanonicalApparatusId(value)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return value.trim();
}

/** @v2 AdminPrintPreflightHold */
export type AdminPrintPreflightHold = { hold_id: string; idempotency_key: string; order_id: string; apparatus: string;
  status: string; revision: number };
export function printPreflightHold(raw: unknown): AdminPrintPreflightHold | null {
  const value = object(raw);
  if (!value) return null;
  const hold_id = errorText(value.hold_id), idempotency_key = errorText(value.idempotency_key), order_id = errorText(value.order_id);
  const apparatus = errorText(value.apparatus), status = errorText(value.status).toLowerCase(), revision = value.revision ?? 0;
  if (!hold_id || !idempotency_key || !order_id || !apparatus || !Number.isInteger(revision) || (revision as number) < 0 ||
      !['held', 'running', 'passed', 'failed', 'cancelled', 'consumed'].includes(status)) return null;
  return { hold_id, idempotency_key, order_id, apparatus, status, revision: revision as number };
}

/** @v2 AdminTemporaryPauseControl */
export type AdminTemporaryPauseControl = { session_id: string; token: string };
export function temporaryPauseControl(raw: unknown): AdminTemporaryPauseControl | null {
  const value = object(raw);
  if (typeof value?.session_id !== 'string' || typeof value.token !== 'string') return null;
  const id = value.session_id;
  if (!id.trim() || id !== id.trim() || id.length > 512 || !hexToken(value.token)) return null;
  return { session_id: id, token: value.token };
}

/** @v2 AdminCancelStartControl */
export type AdminCancelStartControl = AdminTemporaryPauseControl & { worker_ref: string; previous_state: 'pending' | 'completed' };
export function cancelStartControl(raw: unknown): AdminCancelStartControl | null {
  const value = object(raw);
  const base = temporaryPauseControl(raw);
  if (!base || typeof value?.worker_ref !== 'string' || !value.worker_ref || value.worker_ref !== value.worker_ref.trim() ||
      value.worker_ref.length > 512 || (value.previous_state !== 'pending' && value.previous_state !== 'completed')) return null;
  return { ...base, worker_ref: value.worker_ref, previous_state: value.previous_state };
}

/** @v2 AdminResumePauseControl */
export type AdminResumePauseControl = { resume_id: string; worker_role: 'aparatchi' | 'rezka_master'; worker_ref: string };
export function resumePauseControl(raw: unknown): AdminResumePauseControl | null {
  const value = object(raw);
  if (typeof value?.resume_id !== 'string' || typeof value.worker_ref !== 'string' ||
      (value.worker_role !== 'aparatchi' && value.worker_role !== 'rezka_master')) return null;
  const id = value.resume_id.trim(), ref = value.worker_ref.trim();
  return id && id.length <= 512 && ref ? { resume_id: id, worker_role: value.worker_role, worker_ref: ref } : null;
}

/** @v2 AdminReactivationRecloseControl */
export type AdminReactivationRecloseControl = { session_id: string; stage_node_id: string; token: string;
  worker_role: 'aparatchi' | 'rezka_master'; worker_ref: string; readScope: string };
export function reactivationRecloseControl(raw: unknown, session: Session, preserveReadScope = true): AdminReactivationRecloseControl | null {
  const value = object(raw);
  if (!value || (value.worker_role !== 'aparatchi' && value.worker_role !== 'rezka_master') ||
      typeof value.session_id !== 'string' || typeof value.stage_node_id !== 'string' ||
      typeof value.token !== 'string' || typeof value.worker_ref !== 'string' ||
      !value.session_id.trim() || !value.stage_node_id.trim() || !value.token.trim() || !value.worker_ref.trim() ||
      !/^[a-f0-9]{64}$/.test(value.token) || value.session_id.length > 4096 || value.stage_node_id.length > 512) return null;
  return { session_id: value.session_id, stage_node_id: value.stage_node_id, token: value.token,
    worker_role: value.worker_role, worker_ref: value.worker_ref,
    readScope: preserveReadScope && typeof value.readScope === 'string' ? value.readScope : sessionReadScope(session) };
}

const denied = () => new WorkerControlException('queue_action_not_allowed', '');
const scopeChanged = () => new WorkerControlException('session_scope_changed', '');
const belongsTo = (control: AdminReactivationRecloseControl, session: Session) =>
  control.readScope === sessionReadScope(session) && operator(session.profile?.role) &&
  control.worker_role === session.profile?.role && control.worker_ref === session.profile?.ref;

// Fixed-message branches of f119 _adminProductionMapException.
const productionMapErrorMessages: Readonly<Record<string, string>> = Object.freeze({
  "rulon_order_package_not_allowed": "Rulon buyurtmasiga paket apparatini qo‘shib bo‘lmaydi",
  "template_identity_conflict": "Shablon boshqa mahsulot yoki egaga tegishli. Mahsulot uchun yangi mustaqil variant yarating.",
  "duplicate_order_number": "Bu raqam boshqa zakazga berilgan",
  "order_number_immutable": "Zakaz raqamini o‘zgartirish mumkin emas",
  "order_number_exhausted": "Zakaz raqamlari limiti tugagan",
  "move_not_allowed": "Zakaz bu aparatga tushmaydi",
  "started_order_move_requires_transfer": "Ish boshlangan orderni avval pause qilib avariyaviy ko‘chiring",
  "production_map_started_stage_locked": "Ish boshlangan aparat bosqichlarini o‘zgartirib bo‘lmaydi",
  "apparatus_transfer_reason_required": "Avariya sababini kiriting",
  "apparatus_transfer_idempotency_required": "Avariya ko‘chirish identifikatori mavjud emas",
  "apparatus_transfer_idempotency_conflict": "Avariya ko‘chirish identifikatori boshqa amalda ishlatilgan",
  "apparatus_transfer_order_not_paused": "Ko‘chirishdan oldin orderni pause qiling",
  "apparatus_transfer_session_not_found": "Orderning ish sessiyasi topilmadi",
  "apparatus_transfer_progress_not_found": "Orderning pause progressi topilmadi",
  "apparatus_transfer_session_mismatch": "Order sessiyasi apparat bilan mos emas",
  "apparatus_transfer_progress_mismatch": "Order progressi apparat bilan mos emas",
  "apparatus_transfer_target_conflict": "Order tanlangan apparatda allaqachon mavjud",
  "apparatus_transfer_invalid_response": "Avariya ko‘chirish javobi noto‘g‘ri",
  "queue_action_not_allowed": "Faqat navbatdagi zakazni boshlash yoki tugatish mumkin",
  "queue_reorder_conflict": "Navbat o‘zgargan. Yangilangan navbatda qayta suring.",
  "queue_reorder_frozen": "Muzlatilgan buyurtmani navbatda surib bo‘lmaydi.",
  "queue_reorder_blocked": "Ishlayotgan buyurtma bu joyga surishga ruxsat bermaydi.",
  "queue_reorder_invalid": "Navbatni surish so‘rovi mos emas. Navbatni yangilang.",
  "queue_reorder_idempotency_conflict": "Navbatni surish so‘rovi mos emas. Navbatni yangilang.",
  "print_preflight_active": "Buyurtmaning rang sinovi rezervi faol. Hozir bu amalni bajarib bo‘lmaydi.",
  "print_preflight_not_found": "Rang chiqarish sinovi topilmadi. Oynani yangilang va qayta urinib ko‘ring.",
  "print_preflight_not_ready": "Rang chiqarish natijasi hali tayyor emas. Avval “Rang chiqdi” yoki “Chiqmadi” tugmasini bosing.",
  "print_preflight_action_not_allowed": "Rang chiqarish uchun bu amal hozir mumkin emas. Oynani yangilang va qayta urinib ko‘ring.",
  "print_preflight_requires_print_apparatus": "Rang chiqarish faqat bosma apparatida ishlaydi.",
  "print_preflight_action_invalid": "Rang chiqarish amali noto‘g‘ri. Oynani yangilang va qayta urinib ko‘ring.",
  "apparatus and order_id are required": "Aparat yoki buyurtma ma’lumoti topilmadi. Oynani yangilang.",
  "hold_id and idempotency_key are required": "Rang chiqarish so‘rovi to‘liq emas. Oynani yangilang va qayta urinib ko‘ring.",
  "hold_id is required": "Rang chiqarish sinovi topilmadi. Oynani yangilang va qayta urinib ko‘ring.",
  "rezka_frame_count_mismatch": "Tugatish yuborilmadi: kiritilgan kadrlar soni Rezka rulonlari soniga mos emas. Oynani yangilang va qayta kiriting",
  "order_not_started": "Boshlanmagan buyurtmani muzlatib bo‘lmaydi",
  "order_already_completed": "Tugallangan buyurtmani muzlatib bo‘lmaydi",
  "order_freeze_requested": "Buyurtma muzlatish uchun worker pauzasini kutmoqda",
  "order_frozen": "Buyurtma muzlatilgan. Ishni davom ettirish uchun, iltimos, adminga xabar bering va buyurtmani muzdan ochishini so‘rang.",
  "order_control_action_not_allowed": "Buyurtmaning hozirgi holatida bu amal mumkin emas",
  "order_reset_confirmation_required": "Order reset tasdig‘i topilmadi",
  "order_reset_unavailable": "Order reset xizmati mavjud emas",
  "order_reset_failed": "Orderlar tozalanmadi",
  "order_reset_verification_failed": "Order reset yakuniy tekshiruvdan o‘tmadi",
  "order_reset_test_mode_unsupported": "Order reset test rejimida mavjud emas",
  "backup_failed": "Resetdan oldingi backup olinmadi",
  "backup_timed_out": "Resetdan oldingi backup vaqti tugadi",
  "previous_stage_not_completed": "Oldingi bosqich tugallanguncha kutilmoqda",
  "apparatus_not_assigned": "Bu aparat sizga biriktirilmagan",
  "queue_policy_locked": "Bosma aparati doim ketma-ketlik bo‘yicha ishlaydi",
  "bosma_completion_metrics_required": "Bosma tugatish uchun barcha majburiy fieldlarni kiriting",
  "laminatsiya_completion_metrics_required": "Ishni tugatish uchun barcha majburiy qiymatlarni kiriting",
  "laminatsiya_astatka_metrics_required": "Bosmadan, plyonkadan ortgan rulon va chiqindini kiriting",
  "laminatsiya_rubber_too_large": "Rezina razmeri 1050 mm dan katta bo‘lsa laminatsiya mumkin emas",
  "rezka_progress_metrics_required": "Rezka uchun barcha majburiy fieldlarni kiriting",
  "bobina_exceeds_gross": "Babina vazni brutto vazndan katta bo‘lishi mumkin emas",
  "rezka_frame_issue_only_on_roll_progress": "Kadr muammosi faqat Rezka tugatish amalida belgilanadi",
  "rezka_kadr_count_required": "Rezka uchun kadr soni production mapda sozlanmagan",
  "rezka_final_roll_required": "Avval qolgan laminatsiya rulonlarini tugating; to‘liq tugatish faqat oxirgi rulonda mumkin",
  "zero_metric_explanation_required": "0 qiymat kiritilganda sababini yozing",
  "returned_paint_astatka_exceeds_rasxot": "Astatka Rasxotdan katta bo‘lishi mumkin emas",
  "astatka cannot exceed rasxot": "Astatka Rasxotdan katta bo‘lishi mumkin emas",
  "raw_material_scan_required": "Ishni boshlash uchun biriktirilgan homashyoni skaner qiling",
  "raw_material_state_not_ready": "Apparat oldiga homashyo olib kelinmagan",
  "raw_material_scan_incomplete": "Apparat oldidagi barcha homashyolarni skaner qiling",
  "raw_material_requirement_not_met": "Har bir majburiy guruhdan minimum homashyo skaner qiling",
  "raw_material_mismatch": "Bu homashyo ish boshlash uchun mos emas",
  "raw_material_stock_unavailable": "Bu homashyo omborda mavjud emas yoki boshqa zakaz uchun band",
  "raw_material_order_not_active": "Yana homashyo faqat ish boshlangan yoki pauzadagi zakazga olinadi",
  "qolip_scan_required": "Ishni boshlash uchun qolip QR scan qiling",
  "qolip_in_rework": "Buyurtma qoliplari peredelkada. Barcha kerakli qoliplar qaytishi kerak",
  "qolip_scan_incomplete": "Mahsulotga biriktirilgan barcha qoliplarni scan qiling",
  "qolip_code_not_found": "Qolip QR topilmadi",
  "combo_name_conflict": "Bu nomdagi kombo mavjud. Boshqa nom kiriting",
  "combo_reference_mismatch": "Kombo joylashuvi o‘zgargan. Qayta hisoblang",
  "combo_reference_required": "Kombo nomini saqlab, qayta hisoblang",
  "combo_not_found": "Kombo topilmadi",
  "combo_store_unavailable": "Kombo katalogi vaqtincha ishlamayapti",
  "combo_qolip_required": "Kombo uchun qolip biriktirilmagan",
  "qolip_code_mismatch": "Bu qolip ushbu zakaz mahsulotiga mos emas",
  "qolip_code_required": "Kamida bitta qolipni tanlang",
  "qolip_already_in_use": "Bu qolip boshqa aparatda ishlatilmoqda",
  "qolip_location_not_found": "Bu qolip hozir ombor yachaykasida emas",
  "insufficient_stock": "Bu qolip omborda qolmagan",
  "location_identity_mismatch": "Qolip joylashuvi o‘zgargan, qayta skanerlang",
  "raw_material_rule_not_found": "Bu homashyo uchun aparat qoidasi yo‘q",
  "raw_material_assignment_not_found": "Homashyo biriktirilmagan",
  "raw_material_already_assigned_to_order": "Bu homashyo allaqachon shu zakazga ulangan",
  "raw_material_group_not_allowed": "Bu homashyo ish boshlash uchun mos emas",
  "raw_material_group_ambiguous": "Bu homashyoni qaysi aparatga ulashni tanlang",
  "raw_material_roll_size_missing": "Rulon razmeri topilmadi",
  "raw_material_invalid_input": "Homashyo QR noto‘g‘ri",
  "item group is not assigned to material taminotchi": "Bu homashyo sizga biriktirilgan guruhlarga kirmaydi",
  "warehouse is not assigned to material taminotchi": "Bu ombor sizga biriktirilmagan",
  "progress_input_invalid": "Chiqarilgan miqdorni kiriting",
  "progress_qr_required": "Oldingi bosqich QR sini scan qiling",
  "training_input_batch_required": "Avval admin training batch QR sini generatsiya qilishi kerak",
  "training_input_batch_not_found": "Training batch topilmadi",
  "progress_batch_not_found": "Progress QR topilmadi",
  "progress_batch_not_accepted": "Bu QR oldingi bosqich mahsulotiga mos emas",
  "wip_route_source_unresolved": "WIP chiqarilgan bosqich xaritada aniqlanmadi. Admin xaritadagi yo‘nalishni tekshirsin; shu QR saqlanadi.",
  "wip_route_destination_unresolved": "WIP uchun keyingi bosqich xaritada aniqlanmadi. Admin yo‘nalishni tekshirsin; shu QR saqlanadi.",
  "wip_route_ambiguous": "WIP yo‘nalishini bir ma’noda aniqlab bo‘lmadi. Admin xaritadagi bosqichlarni tekshirsin; shu QR saqlanadi.",
  "wip_route_changed": "Ishlab chiqarish xaritasi yangilandi. Oynani yangilang va shu QRni qayta skanerlang.",
  "opening_wip_invalid_input": "Opening WIP ma’lumotlari to‘liq emas",
  "opening_wip_entry_mismatch": "Opening WIP faqat production mapning birinchi aparatidan boshlanishi mumkin",
  "opening_wip_order_already_started": "Ish boshlangan orderga Opening WIP kiritib bo‘lmaydi",
  "opening_wip_location_mismatch": "Joylashuv production mapdagi aparat bo‘lishi kerak",
  "opening_wip_source_mismatch": "Tanlangan chiqish apparati production mapga mos emas",
  "opening_wip_source_final_stage": "Oxirgi aparat chiqish WIP manbasi bo‘la olmaydi",
  "opening_wip_idempotency_conflict": "Bu Opening WIP so‘rovi boshqa ma’lumot bilan ishlatilgan",
  "opening_wip_status_invalid": "Opening WIP holati noto‘g‘ri",
  "opening_wip_qr_mismatch": "Bu QR ushbu orderning kutilayotgan Opening WIP ruloniga mos emas",
  "opening_wip_delete_locked": "Ishlatilgan Opening WIP rulonini o‘chirib bo‘lmaydi",
  "opening_wip_delete": "Opening WIP ruloni o‘chirilmadi",
  "queue_sequence_order_not_found": "Ketma-ketlikdagi buyurtma topilmadi. Oynani yangilang va qayta urinib ko‘ring",
  "queue_sequence_apparatus_mismatch": "Buyurtma tanlangan apparat ketma-ketligiga tegishli emas",
  "print_preflight_invalid_response": "Rang chiqarish serveridan noto‘g‘ri javob keldi. Oynani yangilang",
  "progress_batch_not_resumable": "Bu progress QR davom ettirishga yaramaydi",
  "progress_batch_correction_reason_required": "O‘zgartirish sababini yozing",
  "progress_batch_correction_locked": "Ishlatilgan WIPni o‘zgartirib bo‘lmaydi",
  "progress_batch_correction_conflict": "WIP boshqa joyda yangilangan. Ma’lumotni qayta oching",
  "progress_batch_correction_unchanged": "WIP qiymatlarida o‘zgarish yo‘q",
  "paddon_invalid_input": "Paddon ma’lumoti noto‘g‘ri",
  "paddon_code_exhausted": "Paddon code raqamlari tugagan",
  "paddon_not_found": "Paddon topilmadi",
  "paddon_item_already_assigned": "Bu WIP boshqa paddonga biriktirilgan",
  "paddon_item_not_assigned": "Bu WIP ushbu paddonda yo‘q",
  "scale_driver_not_configured": "Printer ulanmagan",
  "unauthorized": "Sessiya tugagan. Qayta login qiling",
  "forbidden": "Bu amal sizning rolingiz uchun ruxsat etilmagan",
  "method not allowed": "Bu amal bu usulda qo‘llanmaydi",
  "invalid json": "Yuborilgan ma’lumot noto‘g‘ri",
  "production maps fetch failed": "Production maplar yuklanmadi",
  "training_order_number_exists": "Bu training order raqami allaqachon mavjud",
  "training_material_assignment_exists": "Bu QR kodi shu training orderga allaqachon ulangan",
  "training_material_assignment_not_found": "Training homashyo topilmadi",
  "training_material_assignment_required": "Training homashyo tanlanmadi",
  "training_order_not_found": "Tanlangan training order topilmadi",
  "training_map_not_found": "Training order topilmadi",
  "training_apparatus_required": "Training aparat tanlanmadi",
  "training_apparatus_not_found": "Training aparat topilmadi",
  "map_id_required": "Production map yoki aparat canonical ID si topilmadi",
  "map_product_code_required": "Mahsulot kodi kiritilmagan",
  "map_title_required": "Production map nomi kiritilmagan",
  "map_start_required": "Production mapda boshlang‘ich nuqta bo‘lishi kerak",
  "map_end_required": "Production mapda yakuniy nuqta bo‘lishi kerak",
  "duplicate_node_id": "Production mapda node ID takrorlangan",
  "missing_edge_node": "Production mapdagi bog‘lanish nuqtasi topilmadi",
  "production_map_cycle": "Production map ketma-ketligida aylanish bor",
  "formula_target_required": "Formula maqsadi kiritilmagan",
  "formula_expression_required": "Formula ifodasi kiritilmagan",
  "invalid_formula_target": "Formula maqsadi noto‘g‘ri",
  "invalid_formula_expression": "Formula ifodasi noto‘g‘ri",
  "invalid_order_qty": "Zakaz miqdori 0 dan katta bo‘lishi kerak",
  "invalid_print_val_size": "Val razmeri 0 dan katta bo‘lishi kerak",
  "invalid_node_qty": "Bosqich miqdori noto‘g‘ri",
  "invalid_location": "Joylashuv noto‘g‘ri",
  "unknown_formula_variable": "Formula ichidagi o‘zgaruvchi topilmadi",
  "formula_division_by_zero": "Formula 0 ga bo‘lishni o‘z ichiga oladi",
  "condition_branch_required": "Shart uchun true va false yo‘nalishlari kerak",
  "order_freeze_target_not_found": "Buyurtmani muzlatish uchun faol ish sessiyasi topilmadi",
  "order_freeze_target_ambiguous": "Buyurtmani muzlatish uchun bir nechta faol sessiya topildi",
  "order_freeze_request_mismatch": "Muzlatish so‘rovi bu ish sessiyasiga tegishli emas",
  "freeze_safe_stop_output_or_issue_note_required": "Miqdorlarni to‘liq kiriting yoki faqat muammo izohini yozing",
  "freeze_safe_stop_output_incomplete": "Miqdorlar to‘liq emas. Barcha majburiy qiymatlarni kiriting yoki maydonlarni tozalab, faqat muammo izohini yozing",
  "training workspace store failed": "Training server bazasi yangilanmagan yoki ulanmagan. Serverni restart qiling",
  "capacity_profile_invalid": "Aparat quvvati profili noto‘g‘ri",
  "capacity_profile_not_found": "Aparat quvvati profili topilmadi",
  "capability_not_supported": "Bu aparat kerakli ish turini qo‘llamaydi",
  "capability_level_insufficient": "Bu aparatning imkoniyat darajasi yetarli emas",
  "capacity_conflict": "Bu aparatning quvvati tanlangan vaqt uchun band",
  "capacity_no_working_window": "Bu aparat uchun tanlangan vaqt oralig‘ida ish vaqti yo‘q",
  "capacity_unavailable": "Bu aparat tanlangan vaqtda ishlamaydi",
  "schedule_input_invalid": "Jadval ma’lumotlari noto‘g‘ri",
  "schedule_idempotency_conflict": "Bu jadval identifikatori boshqa orderga tegishli",
  "schedule_reservation_not_found": "Jadval bandlovi topilmadi",
  "schedule_reservation_locked": "Bu jadval bandlovini bekor qilib bo‘lmaydi",
  "map_not_found": "Zakaz topilmadi",
  "production_map_load_failed": "Production map yuklanmadi. Qayta urinib ko‘ring"
});

const productionMapErrorOperations: Readonly<Record<string, string>> = Object.freeze({
  "production_maps_list": "Production maplar yuklanmadi",
  "training_maps_list": "Training orderlar yuklanmadi",
  "training_map_save": "Training order saqlanmadi",
  "training_map_save_with_order": "Training order va map saqlanmadi",
  "training_map_delete": "Training order o‘chirilmadi",
  "training_apparatus_modes": "Training apparatlar rejimi olinmadi",
  "training_apparatus_mode_save": "Training aparat rejimi saqlanmadi",
  "training_restart": "Training qayta boshlanmadi",
  "training_material_assignments": "Training homashyo biriktirmalari yuklanmadi",
  "training_material_assignment": "Training homashyo ulanmagan",
  "training_material_assignment_delete": "Training homashyo o‘chirilmadi",
  "training_input_batches": "Training batchlar yuklanmadi",
  "training_input_batch_generate": "Training batch generatsiya qilinmadi",
  "training_input_batch_delete": "Training batch o‘chirilmadi",
  "training_image_save": "Training order rasmi saqlanmadi",
  "production_map_audit": "Workflow audit yuklanmadi",
  "production_map_save": "Production map saqlanmadi",
  "production_map_save_with_order": "Zakaz va production map saqlanmadi",
  "production_map_move_batch": "WIP batch ko‘chirilmagan",
  "apparatus_transfer": "Orderni boshqa apparatga ko‘chirish amalga oshmadi",
  "production_map_move": "Order apparati o‘zgartirilmadi",
  "production_map_sequence": "Orderlar ketma-ketligi saqlanmadi",
  "order_control_failed": "Order holati o‘zgartirilmadi",
  "wip_batches": "WIP batchlar yuklanmadi",
  "completed_orders": "Yakunlangan orderlar yuklanmadi",
  "completion_requests": "Tugatish so‘rovlari yuklanmadi",
  "completion_request_decision": "Tugatish so‘rovi qarori saqlanmadi",
  "completion_request_decisions": "Tugatish qarorlari yuklanmadi",
  "queue_policies": "Aparat navbat qoidalari yuklanmadi",
  "apparatus_capacity": "Aparat quvvati ma’lumotlari olinmadi",
  "apparatus_downtime": "Aparat downtime ma’lumoti saqlanmadi",
  "apparatus_schedule": "Aparat jadvali saqlanmadi",
  "apparatus_schedule_cancel": "Aparat jadvali bekor qilinmadi",
  "raw_material_rules": "Homashyo qoidalari yuklanmadi",
  "raw_material_start_requirements": "Homashyo ish boshlash talablari yuklanmadi",
  "raw_material_assignments": "Homashyo biriktirmalari yuklanmadi",
  "raw_material_assignment_orders": "Homashyo uchun orderlar yuklanmadi",
  "raw_material_assignment_candidates": "Homashyo nomzodlari yuklanmadi",
  "raw_material_assignment_candidate_orders": "Homashyo uchun mos orderlar yuklanmadi",
  "raw_material_intake": "Homashyo qabul qilinmadi",
  "raw_material_intake_candidates": "Qabul qilinadigan homashyolar yuklanmadi",
  "raw_material_history": "Homashyo tarixi yuklanmadi",
  "qolip_code_not_found": "Qolip ma’lumotlari tekshirilmadi",
  "queue_action_not_allowed": "Order navbat amali bajarilmadi",
  "progress_batch_not_found": "Progress QR amali bajarilmadi",
  "progress_qr_reprint": "WIP QR qayta chop etilmadi",
  "paddons_list": "Paddonlar yuklanmadi",
  "paddon_not_found": "Paddon ma’lumoti olinmadi",
  "paddon_create": "Paddon yaratilmadi",
  "paddon_item_add": "WIP paddonga qo‘shilmadi",
  "paddon_item_remove": "WIP paddondan chiqarilmadi",
  "production_map_live_failed": "Production map jonli holati olinmadi",
  "production_map_run": "Production map ishga tushirilmadi"
});

const errorTrim = (value: string) => value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
const errorJsonText = (value: unknown): string => Array.isArray(value) ? `[${value.map(errorJsonText).join(', ')}]`
  : value !== null && typeof value === 'object' ? `{${Object.entries(value).map(([key, item]) => `${key}: ${errorJsonText(item)}`).join(', ')}}` : String(value);
const errorText = (value: unknown) => value == null ? '' : errorTrim(errorJsonText(value));
function errorInteger(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid error diagnostic count');
  return Math.trunc(value);
}
function diagnosticNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = errorText(value);
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(raw)) return null;
  return /^[+-]?NaN$/.test(raw) ? NaN : Number(raw);
}
function errorMillimeters(value: number): string {
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return `${value.toFixed(value === rounded ? 0 : 1)} mm`;
}
function errorWidthMismatch(order: number | null, roll: number | null, minimum: number | null, maximum: number | null): string {
  const min = minimum ?? order;
  if (min === null || roll === null) return 'Bu rulon bu buyurtma uchun mos emas';
  if (roll < min) return `Mos emas: rulon eni ${errorMillimeters(roll)}; talab qilinadigan minimum ${errorMillimeters(min)}.`;
  if (maximum !== null) return `Mos emas: rulon eni ${errorMillimeters(roll)}; ruxsat etilgan oraliq ${errorMillimeters(min)}–${errorMillimeters(maximum)}.`;
  return `Rulon eni ${errorMillimeters(roll)}, buyurtma talabi ${errorMillimeters(min)}. Bu rulon mos emas`;
}
function errorAssignmentLocked(title: string, status: string): string {
  const location = title ? `“${title}” buyurtmasida` : 'bu buyurtmada';
  switch (errorTrim(status).toLowerCase()) {
    case 'in_use': return `Bu homashyo ${location} hozir ishlatilmoqda. Ulanishni uzib bo‘lmaydi`;
    case 'consumed': return `Bu homashyo ${location} ishlatilgan. Ulanishni uzib bo‘lmaydi`;
    default: return title ? `Bu homashyo “${title}” buyurtmasi uchun band. Ulanishni uzib bo‘lmaydi`
      : 'Bu homashyo allaqachon ishga tushgan yoki ishlatilgan, uzib bo‘lmaydi';
  }
}

/** @v2 _adminProductionMapUnknownErrorMessage */
export function productionMapUnknownErrorMessage(code: string, fallback: string, status: number): string {
  const normalized = errorTrim(code).toLowerCase(), key = errorTrim(fallback).toLowerCase();
  const operation = Object.hasOwn(productionMapErrorOperations, key) ? productionMapErrorOperations[key] : 'So‘ralgan amal bajarilmadi';
  const advice = status >= 500 ? '. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring.' : '. Oynani yangilang va qayta urinib ko‘ring.';
  return !normalized || normalized === key ? `${operation}${advice}`
    : `${operation}. Server xato kodi: ${code} (HTTP ${status})${advice}`;
}

/** @v2 _adminProductionMapException */
export function productionMapResponseError(status: number, payload: unknown, fallback: string,
  headers?: Pick<Headers, 'get'>): WorkerControlException {
  let code = fallback, apparatusOptions: string[] = [], details: string[] = [], orderTitle = '', rawMaterialStatus = '', apparatusName = '', serverMessage = '';
  let orderWidth: number | null = null, rollWidth: number | null = null, minimumWidth: number | null = null, maximumWidth: number | null = null;
  let activeKadrCount: number | null = null, scannedKadrCount: number | null = null, diagnostics: JsonObject = {};
  let requestId = headers?.get('x-request-id') ?? null;
  try {
    const row = object(payload);
    if (row) {
      if (typeof row.error === 'string' && errorTrim(row.error)) code = errorTrim(row.error);
      if (Array.isArray(row.apparatus_options)) apparatusOptions = row.apparatus_options.map(value => errorTrim(errorJsonText(value))).filter(Boolean);
      if (Array.isArray(row.blockers)) details = row.blockers.flatMap(value => {
        const blocker = object(value), message = blocker ? errorText(blocker.message) : '';
        return message ? [message] : [];
      });
      diagnostics = row;
      serverMessage = errorText(row.message ?? row.detail ?? '');
      if (requestId === null && row.request_id != null) requestId = errorJsonText(row.request_id);
      apparatusName = errorText(row.apparatus_name); orderTitle = errorText(row.order_title); rawMaterialStatus = errorText(row.raw_material_status);
      orderWidth = diagnosticNumber(row.order_width_mm); rollWidth = diagnosticNumber(row.roll_width_mm);
      minimumWidth = diagnosticNumber(row.minimum_width_mm); maximumWidth = diagnosticNumber(row.maximum_width_mm);
      activeKadrCount = errorInteger(row.active_kadr_count); scannedKadrCount = errorInteger(row.scanned_kadr_count);
    }
  } catch { /* V2 retains earlier fields when a malformed count aborts later diagnostics. */ }
  const normalized = errorTrim(code).toLowerCase();
  let message: string;
  if (Object.hasOwn(productionMapErrorMessages, normalized)) message = productionMapErrorMessages[normalized];
  else switch (normalized) {
    case 'rezka_frame_groups_invalid': message = serverMessage || 'Kesish rejasidagi kadrlar taqsimoti mos emas. Production mapdagi Rezka tugunlari va kadr sonini tekshiring.'; break;
    case 'merge_input_frame_count_mismatch': message = activeKadrCount !== null && scannedKadrCount !== null
      ? `Merge qilinmadi: joriy rulon ${activeKadrCount} kadr, scan qilingan WIP ${scannedKadrCount} kadr. Bir xil kadrli WIPni scan qiling`
      : 'Merge qilinmadi: scan qilingan WIPning kadr soni joriy rulon bilan bir xil emas'; break;
    case 'order_delete_blocked': message = details.length ? details.join('\n') : 'Buyurtmani o‘chirib bo‘lmaydi'; break;
    case 'raw_material_assignment_locked': message = errorAssignmentLocked(orderTitle, rawMaterialStatus); break;
    case 'raw_material_already_assigned': message = orderTitle ? `Bu homashyo “${orderTitle}” buyurtmasi uchun band qilingan` : 'Bu homashyo boshqa zakaz uchun band qilingan'; break;
    case 'raw_material_roll_size_mismatch': message = errorWidthMismatch(orderWidth, rollWidth, minimumWidth, maximumWidth); break;
    case 'progress_batch_already_used': message = `Bu rulon ${apparatusName ? `${apparatusName} apparatida ` : ''}allaqachon ishlatilgan. Qayta ish boshlash uchun ishlatilmagan rulon QR sini skanerlang.`; break;
    case 'progress_batch_in_use': message = `Bu rulon hozir ${apparatusName ? `${apparatusName} apparatida ` : ''}ishlatilmoqda. Uni qayta ishga olib bo‘lmaydi.`; break;
    case 'store_failed': case 'production_map_store_failed': message = fallback === 'production_map_sequence'
      ? 'Ish rejasi navbati serverdan yuklanmadi' : 'Production map ma’lumotlarini saqlashda server xatosi'; break;
    default: message = productionMapUnknownErrorMessage(code, fallback, status);
  }
  return new WorkerControlException(code, message, status, diagnostics, requestId,
    { apparatusOptions, details, activeKadrCount, scannedKadrCount, orderTitle });
}

export async function postWorkerApiRequest(session: Session, path: string, body: JsonObject, scope: string | null,
  checkAfter: boolean, fallback: string, extraGuard?: () => boolean, contentType = 'application/json'): Promise<unknown> {
  const guard = () => {
    if ((scope !== null && scope !== sessionReadScope(session)) || (extraGuard && !extraGuard())) throw scopeChanged();
  };
  // V2 checks test-mode storage asynchronously before sending the command.
  await Promise.resolve();
  guard();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, path, {
      method: 'POST', headers: { 'Content-Type': contentType },
      body: JSON.stringify(body), signal: controller.signal,
    }, guard);
    if (checkAfter) guard();
    if (response.status !== 200) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      if (checkAfter) guard();
      throw productionMapResponseError(response.status, payload, fallback, response.headers);
    }
    const data: unknown = await response.json();
    if (checkAfter) guard();
    return data;
  } finally { clearTimeout(timer); }
}

async function postControl(session: Session, path: string, body: JsonObject, scope: string,
  checkAfter: boolean, extraGuard?: () => boolean): Promise<void> {
  const data = object(await postWorkerApiRequest(session, path, body, scope, checkAfter, 'queue_action_not_allowed', extraGuard));
  if (data?.ok !== true) throw denied();
}

/** @v2 adminTemporarilyPauseWork */
export async function adminTemporarilyPauseWork(session: Session, apparatus: string, orderId: string,
  control: AdminTemporaryPauseControl, current?: () => boolean): Promise<void> {
  const scope = sessionReadScope(session), machine = requireApparatus(apparatus), order = orderId.trim();
  if (!order || order.startsWith('training-') || !temporaryPauseControl(control)) throw denied();
  await postControl(session, '/v1/mobile/admin/production-maps/temporary-pause',
    { apparatus: machine, order_id: order, session_id: control.session_id, token: control.token }, scope, true, current);
}

/** @v2 adminCancelStartedWork */
export async function adminCancelStartedWork(session: Session, apparatus: string, orderId: string,
  control: AdminCancelStartControl): Promise<void> {
  const scope = sessionReadScope(session), machine = requireApparatus(apparatus), order = orderId.trim();
  if (!order || order.startsWith('training-') || !operator(session.profile?.role) ||
      session.profile?.ref !== control.worker_ref || !cancelStartControl(control)) throw denied();
  await postControl(session, '/v1/mobile/admin/production-maps/cancel-start',
    { apparatus: machine, order_id: order, session_id: control.session_id, token: control.token }, scope, true);
}

/** @v2 adminRePauseResumedWork */
export async function adminRePauseResumedWork(session: Session, apparatus: string, orderId: string, resumeId: string): Promise<void> {
  const scope = sessionReadScope(session);
  requireApparatus(apparatus);
  if (!resumeId.trim() || resumeId.length > 512 || !orderId.trim() || orderId.startsWith('training-')) throw denied();
  await postControl(session, '/v1/mobile/admin/production-maps/re-pause',
    { apparatus, order_id: orderId, resume_id: resumeId }, scope, false);
}

/** @v2 adminRecloseReactivatedWork */
export async function adminRecloseReactivatedWork(session: Session, apparatus: string, orderId: string,
  control: AdminReactivationRecloseControl): Promise<void> {
  const scope = sessionReadScope(session);
  requireApparatus(apparatus);
  if (!belongsTo(control, session) || !orderId.trim() || orderId.startsWith('training-')) throw denied();
  await postControl(session, '/v1/mobile/admin/production-maps/reactivation/reclose',
    { apparatus, order_id: orderId, session_id: control.session_id, stage_node_id: control.stage_node_id, token: control.token },
    scope, false, () => belongsTo(control, session));
}

/** @v2 AdminWorkReactivationTarget */
export type AdminWorkReactivationTarget = { apparatus: string; order_id: string; batch_id: string;
  session_id: string; stage_node_id: string; token: string; readScope: string };
/** @v2 AdminWorkReactivationPreview */
export type AdminWorkReactivationPreview = { available: false; denial_reason: string; target: null } |
  { available: true; denial_reason: ''; target: AdminWorkReactivationTarget };

/** @v2 adminWorkReactivationPreview */
export async function adminWorkReactivationPreview(session: Session, apparatus: string, orderId: string,
  batchId = ''): Promise<AdminWorkReactivationPreview> {
  const scope = sessionReadScope(session);
  requireApparatus(apparatus);
  if (!orderId.trim() || orderId.startsWith('training-')) throw new WorkerControlException('reactivation_unavailable', '');
  const raw = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/reactivation/preview',
    { apparatus, order_id: orderId, ...(batchId ? { batch_id: batchId } : {}) }, scope, true, 'reactivation_unavailable'));
  if (!raw) throw new Error('Invalid reactivation response');
  if (raw.available === false) {
    if (typeof raw.denial_reason !== 'string' || !raw.denial_reason.trim()) throw new Error('Missing reactivation denial');
    return { available: false, denial_reason: raw.denial_reason, target: null };
  }
  const target = object(raw.target);
  if (raw.available !== true || !target) throw new Error('Invalid reactivation preview');
  for (const key of ['apparatus', 'order_id', 'batch_id', 'session_id', 'stage_node_id', 'token']) {
    if (typeof target[key] !== 'string' || (key !== 'batch_id' && !(target[key] as string).trim())) throw new Error(`Invalid reactivation ${key}`);
  }
  if (target.apparatus !== apparatus || target.order_id !== orderId || target.batch_id !== batchId) throw new Error('Reactivation target mismatch');
  return { available: true, denial_reason: '', target: {
    apparatus: target.apparatus as string, order_id: target.order_id as string, batch_id: target.batch_id as string,
    session_id: target.session_id as string, stage_node_id: target.stage_node_id as string, token: target.token as string, readScope: scope,
  } };
}

/** @v2 adminReactivateCompletedWork */
export async function adminReactivateCompletedWork(session: Session, target: AdminWorkReactivationTarget): Promise<void> {
  const scope = sessionReadScope(session);
  if (target.readScope !== scope) throw new WorkerControlException('reactivation_unavailable', '');
  const raw = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/reactivation', {
    apparatus: target.apparatus, order_id: target.order_id, ...(target.batch_id ? { batch_id: target.batch_id } : {}),
    session_id: target.session_id, stage_node_id: target.stage_node_id, token: target.token,
  }, scope, true, 'reactivation_unavailable'));
  if (raw?.ok !== true) throw new Error('Reactivation was not acknowledged');
}

export type ReturnedPaintItemInput = { usage: string; category: string; name: string; values: Record<string, string> };

/** @v2 adminBosmaAstatkaReport */
export async function adminBosmaAstatkaReport(session: Session, input: {
  apparatus: string; order_id: string; total_waste: number | null; finished_goods_meter?: number | null;
  finished_goods_kg?: number | null; bobina_kg?: number | null; returned_paint_items: ReturnedPaintItemInput[];
  returned_paint_image_id?: string; description?: string;
}): Promise<JsonObject> {
  const apparatus = input.apparatus.trim(), order = input.order_id.trim();
  const image = (input.returned_paint_image_id ?? '').trim();
  const metrics = [input.finished_goods_meter, input.finished_goods_kg, input.bobina_kg];
  if (!isCanonicalApparatusId(apparatus) || !order || input.total_waste == null || !Number.isFinite(input.total_waste) ||
      input.total_waste < 0 || metrics.some(value => value != null && (!Number.isFinite(value) || value <= 0)) ||
      (!input.returned_paint_items.length && !image)) {
    throw new WorkerControlException('progress_input_invalid', 'Astatka hisobotini to‘liq va to‘g‘ri kiriting');
  }
  const body: JsonObject = {
    apparatus, order_id: order, total_waste: input.total_waste,
    ...(input.finished_goods_meter != null ? { finished_goods_meter: input.finished_goods_meter } : {}),
    ...(input.finished_goods_kg != null ? { finished_goods_kg: input.finished_goods_kg } : {}),
    ...(input.bobina_kg != null ? { bobina_kg: input.bobina_kg } : {}),
    returned_paint_items: input.returned_paint_items.map(item => ({ usage: item.usage, category: item.category, name: item.name, values: item.values })),
    returned_paint_image_id: image, description: (input.description ?? '').trim(),
  };
  const payload = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/bosma-astatka', body,
    null, false, 'bosma_astatka_report_failed'));
  const report = object(payload?.report);
  if (report?.report_id != null && typeof report.report_id !== 'string') throw new TypeError('Invalid report_id');
  if (!report || !report.report_id) throw new WorkerControlException('bosma_astatka_invalid_response', 'Astatka qaydi javobi noto‘g‘ri');
  return report;
}

/** @v2 OrderAlertKind */
export type OrderAlertKind = 'rawMaterial' | 'qolip';

/** @v2 sendOrderAlert */
export async function sendOrderAlert(session: Session, input: {
  order_id: string; apparatus: string; kind: OrderAlertKind; request_id: string;
}): Promise<void> {
  // Test-mode sessions are handled in the shared test-mode port.
  await Promise.resolve();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/order-alert', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ order_id: input.order_id, apparatus: input.apparatus,
        kind: input.kind === 'rawMaterial' ? 'raw_material' : 'qolip', request_id: input.request_id }),
    });
    let payload: JsonObject = {};
    try { payload = object(await response.json()) ?? {}; } catch { /* V2 uses an empty payload for non-JSON responses. */ }
    if (response.status === 200 && payload.ok === true) return;
    const code = payload.error == null ? 'order_alert_send_failed' : String(payload.error);
    throw new WorkerControlException(code, code === 'order_alert_no_recipients'
      ? 'Xabar yuboriladigan faol xodim topilmadi' : 'Xabar yuborilmadi. Qayta urinib ko‘ring', response.status);
  } finally { clearTimeout(timer); }
}
