# Supplier UI contract

Source: V2 `f11910bb2c8c7081ce26770e69811b03fd0739ed`. This contract is in progress; the remaining Supplier screens are not yet inventoried here.

## NotificationDetailScreen

V2: `lib/src/features/shared/presentation/notification_detail_screen.dart`, `_NotificationDetailScreenState_methods_01.dart` and `notification_detail_screen_widgets_part_01.dart`. Entries: Supplier home pending row, notifications, status details and categories; Werka and Customer also use it. The route argument is the receipt ID. A Customer ID beginning `MAT-DN-` redirects to customer detail before marking seen or reading. Other IDs, including `customer_delivery_result:...`, load normally. The role route supplies its dock, back action and cross-role destinations.

On entry and pull-to-refresh, mark the ID seen for the current profile before requesting detail. Show loading while waiting and the shared retry state on failure. A supplier may view a record when its supplier ref is empty or matches the trimmed current profile ref; otherwise pop and show `Bu receipt sizga tegishli emas.` as a snackbar. An account change must reload and clear the comment field. The page title is `Batafsil`. Show supplier name, status, then `Supplier`, `Mahsulot`, `Jo‘natilgan`, `Qabul qilingan` and their record values, with quantities fixed to two decimals. Status words are `Kutilmoqda`, `Qabul qilindi`, `Qisman qabul`, `Rad etildi`, `Bekor qilindi`, `Draft`. Show a nonblank note; for `supplier_ack`, also show a nonblank highlight.

Werka sees `Qabul qilishga o‘tish` only for a pending/draft record with an empty event type; it opens Werka detail with the record. Supplier sees `Rad etaman` and `Tasdiqlayman` only for `werka_unannounced_pending`. Reject opens the dismissible dialog `Rad etish`, optional multiline field `Sabab (ixtiyoriy)`, buttons `Yo‘q`, `Rad etish`; approve opens the dismissible confirmation `Tasdiqlash`, `Haqiqatan ham tasdiqlaysizmi?`, `Yo‘q`, `Ha`. On confirmation send the response, trim the optional reason, update the record and the shared Supplier summary mutation. While sending, disable both actions and show `Yuborilmoqda...` in place of `Tasdiqlayman`; failures show `Javob yuborilmadi: $error` as a snackbar.

Supplier can acknowledge a partial, rejected or cancelled record, or one with a nonblank note, unless it is the unannounced response or a comment by an author starting `Supplier` already contains `tasdiqlayman` case-insensitively. `Tasdiqlayman` opens `Tasdiqlash`, `Haqiqatan ham shu holatni tasdiqlaysizmi?`, `Yo‘q`, `Ha`. On confirmation, send the exact comment `Tasdiqlayman, shu holat bo‘lganini ko‘rdim.`; while sending disable the action and use `Yuborilmoqda...`. `forbidden` errors show `Bu receipt sizga tegishli emas.`, otherwise `Tasdiqlash yuborilmadi: $error`.

Comments appear for partial/rejected/cancelled or a nonblank note, except during unannounced response, for `supplier_ack`, or for Supplier after an acknowledgment. Display `Izohlar`, comments with author, body and created label, or `Hozircha izoh yo‘q.`; a 3–5 line field has `Izoh yozing`. Only a nonblank trimmed value reveals `Comment yuborish`. Send the trimmed comment, clear on success, disable while sending and use `Yuborilmoqda...`; `forbidden` maps to the ownership snackbar and other errors to `Comment yuborilmadi: $error`. Dialogs can be dismissed by back or outside tap in V2. No extra confirmation is shown for comments.

## Remaining Supplier surfaces

Home, item picker, quantity, confirmation, success, recent, notifications, status breakdown, submitted category and status detail still need their complete contract rows before implementation.
