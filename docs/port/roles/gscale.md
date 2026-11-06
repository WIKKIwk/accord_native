# GScale UI contract

Baseline: `7c87a54e78fa99eb89b7342101f6ec468ecf2e19`. V2 sources are
`features/gscale/presentation/gscale_mode_screen.dart`, `gscale_mobile_app.dart` and its
`declarations_part_01`, `widgets_part_02`, dashboard `methods_03`, `methods_05`,
`methods_06` and `resplit2_methods_02/03` parts, and
`features/preparation/presentation/widgets/preparation_kirim_order_section.dart`.
The strings quoted below are the source-text localization keys passed to `uiText`;
dynamic values remain untranslated. No custom haptics are used by these surfaces.

## Entry and navigation

`GScaleModeScreen` receives `GScaleModeArgs` (order, warehouse, material ID and name,
formula variant ID and fresh-form flag). Material supplier and preparation master open
the control-only `Homashyo kirimi` screen with `Print` and `Print tarixi` tabs and an
order field. The other authorized roles open `GScaleMobileApp`, whose dashboard tabs
are `Boshqaruv`, `Arxiv` and `Server`. On entry restore the last printer/scale and
the draft. Device restore failure displays the attention state; never pretend a
device is connected. The back action exits the mode if navigation can pop; at a
root entry V2 opens its logout prompt. Order, device, draft, batch and live state are
served by `GScaleOrderSelectionStore`, `GScaleDeviceStore`, and
`GScaleOperatorStore`; the latter owns validation and actions.

## Print device picker

`ServerPickerPage` is entered from `Printer yoki tarozi tanlash` / `Almashtirish`.
The initial `Qurilma tanlash` choice offers `Wi-Fi qurilma`, `Bluetooth printer`
and `USB printer`; back returns to the choices, dismiss returns without changing the
device. Wi-Fi starts discovery immediately, shows searching, empty and discovered
servers, and supports refresh/retry and `Wi-Fi manzilini qo‘shish`. Manual entry
validates the address, probes the server, displays the returned error and accepts
only a responding server. Bluetooth lists real discovered printers and their
loading, empty and permission/error states. USB detects a real attached printer,
showing detection and error states. Selection saves the device and updates the
dashboard; the Wi-Fi server supplies live monitor updates. Hardware permissions and
unavailable/disconnected devices are not simulated.

## Order and context

`PreparationKirimOrderSection` loads non-saved orders from preparation snapshot or,
for the material supplier, raw-material-assignment orders. Loading, retryable
`Orderlar yuklanmadi`, `Buyurtma topilmadi`, current selection and optional `Order
eni: … mm` are distinct. `Order tanlang` opens searchable, paged choices; a choice
updates the operator order and can prefill a single matching material. An unresolved
or active batch, pending action, request or preset locks order changes; a loaded
selection is published once the lock clears.

The dashboard shows printer connection and live `Joriy kg`; unresolved batch shows
`Batch holati tekshirilmoqda…` with `Holatni qayta tekshirish`. It shows backend,
connection, validation, preset and print errors. Active/saved context is summarized
and `O‘zgartirish` asks the controller to edit; active batch refuses edits until
stopped. Otherwise `Ombor tanlang` and `Mahsulot tanlang` open searchable catalog
pickers with loading, empty, retry and paging states. A non-material role must select
the item before its item-scoped warehouse. Material roles may pick warehouse first;
the selected order can restrict materials and expand micron choices. Changing an
order or item invalidates stale selection results. Initial warehouse and a fresh
formula preset are honored; preset loading/errors and conflicts are shown.
The product picker offers photo-based AI search: choose the camera or gallery,
show permission, inference and no-result errors, and search using the inferred
display and background queries. `gscalePhotoSearch*` supplies the V2 multipart
request, query expansion and relevance order.

`Eni (mm)`, `Mikron` and `Metraj (m)` use the controller's dimension requirements
and validation, including the displayed order-width warning. `Miqdor (kg)` selects
`Qo‘lda kg` or `Tarozidan kg`; `Babina` selects `Bor` / `Yo‘q` and exposes `Babina
og‘irligi`. `Saqlash` is enabled only by `gscaleControlViewModel.saveEnabled`.
Printer settings choose `Zebra` / `GoDEX` and `RFID` / `Faqat yorliq`; GoDEX uses
label mode. They are locked during an active batch or print action.

Manual mode shows `Qo‘lda brutto kg`, `Duplicate soni` and, for material receipt,
`Ta’minotchi` (`Tanlanmagan`, `Xitoy`, `Sirdaryo`). `Boshlash`, `Chop etish`, and
`To‘xtatish` use the corresponding view-model gates and the authoritative batch.
Starting may ask for an apparatus from the order's options. Scale mode starts or
stops the batch and automatically prints a stable eligible weight; show `Stable kg
avtomatik chop etiladi.` or `Stable kg kutilmoqda.`. Preparation's simple warehouse
uses `Kirim kg` and `Kirim qilish` with its own gate and no batch print. Loading,
conflicts, action failure and successful notices remain visible.

## History and server

Selecting `Print tarixi` / `Arxiv` refreshes history. Show loading, error, empty,
and batch entries with item, warehouse, state, time and gross/net quantities.
Opening a batch shows its printed receipts; opening a receipt displays its QR and
reprint action. `Partiya QR chop etish` requires V2's confirmation, disables
concurrent prints and reports success or failure. Reprinting retains ERP identity
checks and confirmation through `GScaleOperatorStore`.

The non-control `Server` section shows the selected server and connection, scale,
printer and batch states, latency, RPS driver and RS / ERP address; an unavailable
server offers device selection and retry. Warehouse settings select manual or a
searchable default warehouse and save the choice to the local draft. `Boshqaruv`, `Arxiv`, `Server`, `Print`,
`Print tarixi`, `Qidirish`, `Qayta urinish`, `Yangilash`, `Bekor qilish`, `Boshlash`,
`To‘xtatish`, `Chop etish`, and `Saqlash` are localization source keys.
